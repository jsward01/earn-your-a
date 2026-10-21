import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { ARCHIVED_MESSAGE, NO_MAKEUP, getAssignmentRow, nextMakeupState, toAssignmentJson, type AssignmentRow } from "../../_lib/assignments";
import { computeAssignmentReward, getBalance, getFullRewardSettings, syncAssignmentRewardTransaction } from "../../_lib/rewards";
import { affectsLedger, checkStudentDelete, checkStudentEdit, diffFields, fieldsFromRow, gradeError, isIsoDate, summarizeChanges, type Fields } from "../../_lib/assignmentEdits";
import { deleteAssignmentWithHistory, getRecordedReward, recordHistory } from "../../_lib/history";
import { classKeyOf, isTrackOnlyClass } from "../../_lib/classSettings";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const VALID_TYPES = new Set(["assignment", "quiz", "test"]);
const VALID_STATUSES = new Set(["pending", "graded", "missing"]);

interface PatchBody {
  title?: string;
  subject?: string;
  type?: string;
  dueDate?: string;
  status?: string;
  grade?: number | null;
}

/**
 * Edit an assignment.
 *
 * - Students may only change details (title/subject/type/due date) of work that is still pending. Grades and the
 *   graded/missing status belong to parents, and that's enforced here, not just by hiding buttons.
 * - The ledger is only re-priced when type, status or grade actually changes (at the family's *current* rates);
 *   renaming, re-dating, or re-saving an unchanged item never touches money.
 * - `?dryRun=1` returns exactly what saving would do (changes, ledger before/after, balance before/after) and writes nothing.
 * - Every real change is recorded in assignment_history.
 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const id = String(context.params.id);
  const existing = await getAssignmentRow(db, id);
  if (!existing || existing.family_id !== user.familyId || (user.role === "student" && existing.student_id !== user.id)) {
    return json({ error: "Not found" }, 404);
  }
  if (existing.payout_id) return json({ error: ARCHIVED_MESSAGE }, 409);

  let body: PatchBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (user.role === "student") {
    const verdict = checkStudentEdit(existing.status, body);
    if (!verdict.ok) return json({ error: verdict.error }, 403);
  }

  const before = fieldsFromRow(existing);
  const isStudent = user.role === "student";
  const after: Fields = {
    title: body.title?.trim() ?? before.title,
    subject: body.subject?.trim() ?? before.subject,
    type: (body.type ?? before.type) as Fields["type"],
    dueDate: body.dueDate ?? before.dueDate,
    // A student's request can't move these (checkStudentEdit already refused anything else).
    status: isStudent ? before.status : ((body.status ?? before.status) as Fields["status"]),
    grade: isStudent ? before.grade : body.grade === undefined ? before.grade : body.grade,
  };

  if (!after.title || !after.subject) return json({ error: "title and subject can't be empty" }, 400);
  if (!VALID_TYPES.has(after.type)) return json({ error: "Invalid type" }, 400);
  if (!VALID_STATUSES.has(after.status)) return json({ error: "Invalid status" }, 400);
  if (!isIsoDate(after.dueDate)) return json({ error: "dueDate must be YYYY-MM-DD" }, 400);
  const gErr = gradeError(after.grade);
  if (gErr) return json({ error: gErr }, 400);

  const changes = diffFields(before, after);
  const changed = Object.keys(changes).length > 0;

  const settings = await getFullRewardSettings(db, user.familyId);
  const ledgerBefore = await getRecordedReward(db, id);
  const historyOnly = existing.history_only === 1;
  // Moving work to another class takes on that class's Pays / Track only setting (and is priced again if that flips it).
  const wasTrackOnly = existing.track_only === 1;
  const trackOnly = classKeyOf(after.subject) === classKeyOf(before.subject)
    ? wasTrackOnly
    : await isTrackOnlyClass(db, existing.student_id, after.subject);
  const relevant = affectsLedger(changes) || trackOnly !== wasTrackOnly;
  const ledgerAfter = relevant ? (computeAssignmentReward({ ...after, historyOnly, trackOnly }, settings)?.amount ?? null) : ledgerBefore;
  const delta = (ledgerAfter ?? 0) - (ledgerBefore ?? 0);
  const balanceBefore = await getBalance(db, existing.student_id);
  const trackNote = trackOnly === wasTrackOnly ? "" : trackOnly ? " (Track only class, no reward)" : " (class pays rewards)";
  const impact = {
    changed,
    changes,
    summary: summarizeChanges(changes) + trackNote,
    ledgerBefore,
    ledgerAfter,
    delta,
    balanceBefore,
    balanceAfter: balanceBefore + delta,
  };

  if (new URL(context.request.url).searchParams.get("dryRun") === "1") return json(impact, 200);
  if (!changed) return json(toAssignmentJson(existing), 200);

  // Makeup windows only move when the outcome (status/grade) moves; a rename or new due date leaves them alone.
  const outcomeChanged = !!(changes.status || changes.grade);
  const makeup = historyOnly || trackOnly
    ? NO_MAKEUP
    : outcomeChanged
    ? nextMakeupState({ deadline: existing.makeup_deadline }, after.status, after.grade, settings.passingThreshold, settings.makeupWindowDays, new Date())
    : { deadline: existing.makeup_deadline, used: existing.makeup_used };

  await db
    .prepare(
      `UPDATE assignments SET title = ?, subject = ?, type = ?, due_date = ?, status = ?, grade = ?, makeup_deadline = ?, makeup_used = ?, track_only = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(after.title, after.subject, after.type, after.dueDate, after.status, after.grade, makeup.deadline, makeup.used, trackOnly ? 1 : 0, id)
    .run();

  if (relevant) {
    await syncAssignmentRewardTransaction(
      db,
      { assignmentId: id, familyId: user.familyId, studentId: existing.student_id },
      { type: after.type as AssignmentRow["type"], status: after.status as AssignmentRow["status"], grade: after.grade, title: after.title, historyOnly, trackOnly },
      settings,
    );
  } else if (changes.title) {
    await db.prepare("UPDATE reward_transactions SET reason = ? WHERE assignment_id = ?").bind(after.title, id).run();
  }

  await recordHistory(db, {
    familyId: user.familyId,
    assignmentId: id,
    studentId: existing.student_id,
    actorId: user.id,
    action: "update",
    summary: impact.summary,
    ledgerBefore,
    ledgerAfter,
  });

  return json(toAssignmentJson((await getAssignmentRow(db, id))!), 200);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const id = String(context.params.id);
  const existing = await getAssignmentRow(db, id);
  if (!existing || existing.family_id !== user.familyId || (user.role === "student" && existing.student_id !== user.id)) {
    return json({ error: "Not found" }, 404);
  }
  if (existing.payout_id) return json({ error: ARCHIVED_MESSAGE }, 409);

  if (user.role === "student") {
    const verdict = checkStudentDelete(existing.status);
    if (!verdict.ok) return json({ error: verdict.error }, 403);
  }

  await deleteAssignmentWithHistory(db, existing, user.familyId, user.id);

  return new Response(null, { status: 204 });
};
