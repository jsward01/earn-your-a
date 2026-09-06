import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { nextMakeupState, toAssignmentJson, type AssignmentRow } from "../../_lib/assignments";
import { getFullRewardSettings, syncAssignmentRewardTransaction } from "../../_lib/rewards";

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

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const id = String(context.params.id);
  const existing = await context.env.DB
    .prepare("SELECT * FROM assignments WHERE id = ? AND family_id = ?")
    .bind(id, user.familyId)
    .first<AssignmentRow>();
  if (!existing) return json({ error: "Not found" }, 404);

  let body: PatchBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const title = body.title?.trim() ?? existing.title;
  const subject = body.subject?.trim() ?? existing.subject;
  const type = body.type ?? existing.type;
  const dueDate = body.dueDate ?? existing.due_date;
  const status = body.status ?? existing.status;
  const grade = body.grade === undefined ? existing.grade : body.grade;

  if (!VALID_TYPES.has(type)) return json({ error: "Invalid type" }, 400);
  if (!VALID_STATUSES.has(status)) return json({ error: "Invalid status" }, 400);

  const settings = await getFullRewardSettings(context.env.DB, user.familyId);
  const makeup = nextMakeupState(
    { deadline: existing.makeup_deadline },
    status,
    grade,
    settings.passingThreshold,
    settings.makeupWindowDays,
    new Date(),
  );

  await context.env.DB
    .prepare(
      `UPDATE assignments SET title = ?, subject = ?, type = ?, due_date = ?, status = ?, grade = ?, makeup_deadline = ?, makeup_used = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(title, subject, type, dueDate, status, grade, makeup.deadline, makeup.used, id)
    .run();

  await syncAssignmentRewardTransaction(
    context.env.DB,
    { assignmentId: id, familyId: user.familyId, studentId: existing.student_id },
    { type: type as AssignmentRow["type"], status: status as AssignmentRow["status"], grade, title },
    settings,
  );

  const row = await context.env.DB.prepare("SELECT * FROM assignments WHERE id = ?").bind(id).first<AssignmentRow>();
  return json(toAssignmentJson(row!), 200);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const id = String(context.params.id);
  const existing = await context.env.DB
    .prepare("SELECT id FROM assignments WHERE id = ? AND family_id = ?")
    .bind(id, user.familyId)
    .first<{ id: string }>();
  if (!existing) return json({ error: "Not found" }, 404);

  await context.env.DB.prepare("DELETE FROM reward_transactions WHERE assignment_id = ?").bind(id).run();
  await context.env.DB.prepare("DELETE FROM assignments WHERE id = ?").bind(id).run();

  return new Response(null, { status: 204 });
};
