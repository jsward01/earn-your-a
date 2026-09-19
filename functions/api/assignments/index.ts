import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { ASSIGNMENT_SELECT, getAssignmentRow, nextMakeupState, toAssignmentJson, type AssignmentRow } from "../../_lib/assignments";
import { checkStudentCreate, gradeError, isIsoDate } from "../../_lib/assignmentEdits";
import { recordHistory } from "../../_lib/history";
import { getFullRewardSettings, syncAssignmentRewardTransaction } from "../../_lib/rewards";
import { resolveStudentId } from "../../_lib/students";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const VALID_TYPES = new Set(["assignment", "quiz", "test"]);
const VALID_STATUSES = new Set(["pending", "graded", "missing"]);

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  const { results } = await context.env.DB
    .prepare(`${ASSIGNMENT_SELECT} WHERE a.family_id = ? AND a.student_id = ? ORDER BY a.due_date ASC`)
    .bind(user.familyId, resolved.studentId)
    .all<AssignmentRow>();

  return json(results.map(toAssignmentJson), 200);
};

interface CreateBody {
  title?: string;
  subject?: string;
  type?: string;
  dueDate?: string;
  status?: string;
  grade?: number | null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  let body: CreateBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  // Grading belongs to parents: a student can add work, but only ever as pending and ungraded.
  if (user.role === "student") {
    const verdict = checkStudentCreate(body);
    if (!verdict.ok) return json({ error: verdict.error }, 403);
  }

  const title = body.title?.trim();
  const subject = body.subject?.trim();
  const type = body.type ?? "assignment";
  const dueDate = body.dueDate;
  const status = user.role === "student" ? "pending" : (body.status ?? "pending");
  const grade = user.role === "student" ? null : (body.grade ?? null);

  if (!title || !subject || !dueDate) {
    return json({ error: "title, subject, and dueDate are required" }, 400);
  }
  if (!VALID_TYPES.has(type)) return json({ error: "Invalid type" }, 400);
  if (!VALID_STATUSES.has(status)) return json({ error: "Invalid status" }, 400);
  if (!isIsoDate(dueDate)) return json({ error: "dueDate must be YYYY-MM-DD" }, 400);
  const gErr = gradeError(grade);
  if (gErr) return json({ error: gErr }, 400);

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
  const { studentId } = resolved;

  const settings = await getFullRewardSettings(context.env.DB, user.familyId);
  const makeup = nextMakeupState({ deadline: null }, status, grade, settings.passingThreshold, settings.makeupWindowDays, new Date());

  const id = crypto.randomUUID();
  await context.env.DB
    .prepare(
      `INSERT INTO assignments (id, family_id, student_id, title, subject, type, due_date, status, grade, makeup_deadline, makeup_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, user.familyId, studentId, title, subject, type, dueDate, status, grade, makeup.deadline, makeup.used)
    .run();

  await syncAssignmentRewardTransaction(
    context.env.DB,
    { assignmentId: id, familyId: user.familyId, studentId },
    { type: type as AssignmentRow["type"], status: status as AssignmentRow["status"], grade, title },
    settings,
  );

  const row = (await getAssignmentRow(context.env.DB, id))!;
  await recordHistory(context.env.DB, {
    familyId: user.familyId,
    assignmentId: id,
    studentId,
    actorId: user.id,
    action: "create",
    summary: `Added "${title}" (${type}, due ${dueDate})${status === "graded" ? `, graded ${grade}%` : status === "missing" ? ", marked missing" : ""}`,
    ledgerBefore: null,
    ledgerAfter: row.recorded_reward ?? null,
  });
  return json(toAssignmentJson(row), 201);
};
