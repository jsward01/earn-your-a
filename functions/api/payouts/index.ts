import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { getFullRewardSettings, getBalance } from "../../_lib/rewards";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface PayoutRow {
  id: string;
  amount: number;
  holdback_amount: number;
  status: string;
  requested_at: string;
  resolved_at: string | null;
}

function toJson(row: PayoutRow) {
  return {
    id: row.id,
    amount: row.amount,
    holdbackAmount: row.holdback_amount,
    status: row.status,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at,
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM payout_requests WHERE family_id = ? ORDER BY requested_at DESC")
    .bind(user.familyId)
    .all<PayoutRow>();

  return json(results.map(toJson), 200);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "student") return json({ error: "Only the student can request a payout" }, 403);

  const existingPending = await context.env.DB
    .prepare("SELECT id FROM payout_requests WHERE family_id = ? AND status = 'pending' LIMIT 1")
    .bind(user.familyId)
    .first<{ id: string }>();
  if (existingPending) return json({ error: "A payout request is already pending" }, 409);

  const settings = await getFullRewardSettings(context.env.DB, user.familyId);
  const balance = await getBalance(context.env.DB, user.id);
  const available = Math.max(0, balance - settings.holdback);
  if (available <= 0) return json({ error: "No available balance to request" }, 400);

  const id = crypto.randomUUID();
  await context.env.DB
    .prepare(
      `INSERT INTO payout_requests (id, family_id, student_id, amount, holdback_amount, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
    )
    .bind(id, user.familyId, user.id, available, settings.holdback)
    .run();

  const row = await context.env.DB.prepare("SELECT * FROM payout_requests WHERE id = ?").bind(id).first<PayoutRow>();
  return json(toJson(row!), 201);
};
