import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { getRewardSettings, getStudentId, nextMakeupState, toAssignmentJson, type AssignmentRow } from "../../_lib/assignments";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const VALID_TYPES = new Set(["assignment", "quiz", "test"]);
const VALID_STATUSES = new Set(["pending", "graded", "missing"]);

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM assignments WHERE family_id = ? ORDER BY due_date ASC")
    .bind(user.familyId)
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

  const title = body.title?.trim();
  const subject = body.subject?.trim();
  const type = body.type ?? "assignment";
  const dueDate = body.dueDate;
  const status = body.status ?? "pending";
  const grade = body.grade ?? null;

  if (!title || !subject || !dueDate) {
    return json({ error: "title, subject, and dueDate are required" }, 400);
  }
  if (!VALID_TYPES.has(type)) return json({ error: "Invalid type" }, 400);
  if (!VALID_STATUSES.has(status)) return json({ error: "Invalid status" }, 400);

  const studentId = await getStudentId(context.env.DB, user.familyId);
  if (!studentId) return json({ error: "No student found for this family" }, 400);

  const { passingThreshold, makeupWindowDays } = await getRewardSettings(context.env.DB, user.familyId);
  const makeup = nextMakeupState({ deadline: null }, status, grade, passingThreshold, makeupWindowDays, new Date());

  const id = crypto.randomUUID();
  await context.env.DB
    .prepare(
      `INSERT INTO assignments (id, family_id, student_id, title, subject, type, due_date, status, grade, makeup_deadline, makeup_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, user.familyId, studentId, title, subject, type, dueDate, status, grade, makeup.deadline, makeup.used)
    .run();

  const row = await context.env.DB.prepare("SELECT * FROM assignments WHERE id = ?").bind(id).first<AssignmentRow>();
  return json(toAssignmentJson(row!), 201);
};
