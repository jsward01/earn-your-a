import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface PayoutRow {
  id: string;
  family_id: string;
  student_id: string;
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

interface PatchBody {
  action?: "approve" | "deny";
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can resolve a payout" }, 403);

  const id = String(context.params.id);
  const existing = await context.env.DB
    .prepare("SELECT * FROM payout_requests WHERE id = ? AND family_id = ?")
    .bind(id, user.familyId)
    .first<PayoutRow>();
  if (!existing) return json({ error: "Not found" }, 404);
  if (existing.status !== "pending") return json({ error: "Payout request has already been resolved" }, 400);

  let body: PatchBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (body.action !== "approve" && body.action !== "deny") {
    return json({ error: "action must be 'approve' or 'deny'" }, 400);
  }

  if (body.action === "approve") {
    await context.env.DB
      .prepare(
        `INSERT INTO reward_transactions (id, family_id, student_id, assignment_id, amount, reason)
         VALUES (?, ?, ?, NULL, ?, 'Payout approved')`,
      )
      .bind(crypto.randomUUID(), user.familyId, existing.student_id, -existing.amount)
      .run();
  }

  const newStatus = body.action === "approve" ? "paid" : "denied";
  await context.env.DB
    .prepare("UPDATE payout_requests SET status = ?, resolved_at = datetime('now'), resolved_by = ? WHERE id = ?")
    .bind(newStatus, user.id, id)
    .run();

  const row = await context.env.DB.prepare("SELECT * FROM payout_requests WHERE id = ?").bind(id).first<PayoutRow>();
  return json(toJson(row!), 200);
};
