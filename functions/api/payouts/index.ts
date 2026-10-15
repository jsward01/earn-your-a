import type { Env } from "../../_lib/env";
import { getSessionUser, type SessionUser } from "../../_lib/session";
import { getFullRewardSettings, getBalance, holdbackFor, availableFor } from "../../_lib/rewards";
import { resolveStudentId } from "../../_lib/students";
import { payOutStatements } from "../../_lib/payouts";

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

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM payout_requests WHERE student_id = ? ORDER BY requested_at DESC")
    .bind(resolved.studentId)
    .all<PayoutRow>();

  return json(results.map(toJson), 200);
};

/**
 * Start a payout.
 * - A student asks for everything available (balance minus holdback); it waits for a parent to approve or deny it.
 * - A parent can pay out at any time, whatever the payout schedule: it is paid at once (same ledger/archive writes as
 *   approving a request). Optional `amount` (default: what's available), up to the whole balance — the holdback is the
 *   parent's own rule, so they may pay into it. If the student already has a request waiting, the parent answers that
 *   instead (409).
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  return user.role === "parent" ? parentPayout(context, user) : studentRequest(context, user);
};

async function studentRequest(context: EventContext<Env, string, unknown>, user: SessionUser): Promise<Response> {
  const existingPending = await context.env.DB
    .prepare("SELECT id FROM payout_requests WHERE student_id = ? AND status = 'pending' LIMIT 1")
    .bind(user.id)
    .first<{ id: string }>();
  if (existingPending) return json({ error: "A payout request is already pending" }, 409);

  const settings = await getFullRewardSettings(context.env.DB, user.familyId);
  const balance = await getBalance(context.env.DB, user.id);
  const available = availableFor(balance, settings);
  if (available <= 0) return json({ error: "No available balance to request" }, 400);

  const id = crypto.randomUUID();
  await context.env.DB
    .prepare(
      `INSERT INTO payout_requests (id, family_id, student_id, amount, holdback_amount, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
    )
    .bind(id, user.familyId, user.id, available, holdbackFor(balance, settings))
    .run();

  const row = await context.env.DB.prepare("SELECT * FROM payout_requests WHERE id = ?").bind(id).first<PayoutRow>();
  return json(toJson(row!), 201);
}

async function parentPayout(context: EventContext<Env, string, unknown>, user: SessionUser): Promise<Response> {
  const db = context.env.DB;
  const resolved = await resolveStudentId(db, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
  const studentId = resolved.studentId;

  let body: { amount?: unknown } = {};
  try {
    const text = await context.request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const existingPending = await db
    .prepare("SELECT id FROM payout_requests WHERE student_id = ? AND status = 'pending' LIMIT 1")
    .bind(studentId)
    .first<{ id: string }>();
  if (existingPending) return json({ error: "There's already a payout request waiting — approve or deny it first" }, 409);

  const settings = await getFullRewardSettings(db, user.familyId);
  const balance = await getBalance(db, studentId);
  const available = availableFor(balance, settings);
  let amount = available;
  if (body.amount !== undefined) {
    if (typeof body.amount !== "number" || !Number.isFinite(body.amount)) return json({ error: "amount must be a number" }, 400);
    amount = Math.round(body.amount * 100) / 100;
  }
  if (amount <= 0) return json({ error: balance > 0 ? "Enter an amount above zero" : "There's nothing to pay out" }, 400);
  if (amount > balance) return json({ error: "That's more than the balance" }, 400);

  const id = crypto.randomUUID();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO payout_requests (id, family_id, student_id, amount, holdback_amount, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(id, user.familyId, studentId, amount, Math.max(0, Math.round((balance - amount) * 100) / 100)),
    ...payOutStatements(db, id, studentId, user.id),
  ]);
  if (results[results.length - 1].meta.changes !== 1) return json({ error: "The payout didn't go through — try again" }, 500);

  const row = await db.prepare("SELECT * FROM payout_requests WHERE id = ?").bind(id).first<PayoutRow>();
  return json(toJson(row!), 201);
}
