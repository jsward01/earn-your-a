import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";
import { resolveStudentId } from "../_lib/students";
import { getBalance } from "../_lib/rewards";
import { validateAdjustment } from "../_lib/adjustments";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface AdjustmentRow {
  id: string;
  amount: number;
  reason: string;
  payout_id: string | null;
  created_at: string;
  created_by_name: string | null;
}

function toJson(r: AdjustmentRow) {
  return { id: r.id, amount: r.amount, reason: r.reason, payoutId: r.payout_id, createdAt: r.created_at, createdByName: r.created_by_name };
}

const SELECT = `SELECT t.id, t.amount, t.reason, t.payout_id, t.created_at, u.name AS created_by_name
                FROM reward_transactions t LEFT JOIN users u ON u.id = t.created_by
                WHERE t.kind = 'adjustment'`;

/** A student's manual adjustments, newest first. Students can see their own (with the reason); parents any in the family. */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  const { results } = await context.env.DB
    .prepare(`${SELECT} AND t.family_id = ? AND t.student_id = ? ORDER BY t.created_at DESC, t.rowid DESC`)
    .bind(user.familyId, resolved.studentId)
    .all<AdjustmentRow>();
  return json(results.map(toJson), 200);
};

/**
 * Parent-only: add a manual +/- entry with a reason. Adjustments are append-only — there is no edit or delete;
 * a mistake is undone by adding one the other way, so the record of both stays. Like grades, an adjustment is
 * settled (and locked) by the next approved payout.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can add an adjustment" }, 403);

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
  const { studentId } = resolved;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const input = validateAdjustment(body);
  if ("error" in input) return json({ error: input.error }, 400);

  const id = crypto.randomUUID();
  await context.env.DB
    .prepare(
      `INSERT INTO reward_transactions (id, family_id, student_id, assignment_id, amount, reason, kind, created_by)
       VALUES (?, ?, ?, NULL, ?, ?, 'adjustment', ?)`,
    )
    .bind(id, user.familyId, studentId, input.amount, input.reason, user.id)
    .run();

  const row = await context.env.DB.prepare(`${SELECT} AND t.id = ?`).bind(id).first<AdjustmentRow>();
  const balance = await getBalance(context.env.DB, studentId);
  return json({ adjustment: toJson(row!), balance }, 201);
};
