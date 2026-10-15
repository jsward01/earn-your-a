import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { payOutStatements } from "../../_lib/payouts";

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

  // Approve = the pay-out writes (see payOutStatements); deny = just the status, guarded the same way.
  const db = context.env.DB;
  const statements =
    body.action === "approve"
      ? payOutStatements(db, id, existing.student_id, user.id)
      : [
          db
            .prepare("UPDATE payout_requests SET status = 'denied', resolved_at = datetime('now'), resolved_by = ? WHERE id = ? AND status = 'pending'")
            .bind(user.id, id),
        ];
  const results = await db.batch(statements);
  if (results[results.length - 1].meta.changes !== 1) return json({ error: "Payout request has already been resolved" }, 409);

  const row = await db.prepare("SELECT * FROM payout_requests WHERE id = ?").bind(id).first<PayoutRow>();
  return json(toJson(row!), 200);
};
