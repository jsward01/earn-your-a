import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";
import { getStudentId } from "../_lib/assignments";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const studentId = await getStudentId(context.env.DB, user.familyId);
  if (!studentId) return json(null, 200);

  const row = await context.env.DB
    .prepare("SELECT id, name, target_amount FROM savings_goals WHERE student_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(studentId)
    .first<GoalRow>();

  return json(row ? { name: row.name, amount: row.target_amount } : null, 200);
};

interface PutBody {
  name?: string;
  amount?: number;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const studentId = await getStudentId(context.env.DB, user.familyId);
  if (!studentId) return json({ error: "No student found for this family" }, 400);

  let body: PutBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const name = body.name?.trim();
  const amount = body.amount;
  if (!name || typeof amount !== "number" || !(amount > 0)) {
    return json({ error: "name and a positive amount are required" }, 400);
  }

  const existing = await context.env.DB
    .prepare("SELECT id FROM savings_goals WHERE student_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(studentId)
    .first<{ id: string }>();

  if (existing) {
    await context.env.DB
      .prepare("UPDATE savings_goals SET name = ?, target_amount = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(name, amount, existing.id)
      .run();
  } else {
    await context.env.DB
      .prepare("INSERT INTO savings_goals (id, student_id, name, target_amount) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), studentId, name, amount)
      .run();
  }

  return json({ name, amount }, 200);
};
