import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { resolveStudentId } from "../../_lib/students";
import { CATCH_UP_KIND } from "../../_lib/reprice";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface TxRow {
  id: string;
  amount: number;
  reason: string;
  assignment_id: string | null;
  created_at: string;
  kind: string | null;
  subject: string | null;
  type: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
  const { studentId } = resolved;

  const { results } = await context.env.DB
    .prepare(
      `SELECT t.id, t.amount, t.reason, t.assignment_id, t.created_at, t.kind, a.subject, a.type
       FROM reward_transactions t
       LEFT JOIN assignments a ON a.id = t.assignment_id
       WHERE t.student_id = ?
       ORDER BY t.created_at DESC
       LIMIT 500`,
    )
    .bind(studentId)
    .all<TxRow>();

  return json(groupCatchUps(results), 200);
};

interface TxJson {
  id: string;
  amount: number;
  reason: string;
  subject: string | null;
  type: string | null;
  createdAt: string;
}

/**
 * A rate-change recalculation writes one catch-up row per paid-out item (so each item's total stays right), but the
 * student and parent see it as the single entry it is: "Rate change catch-up (43 paid items)".
 */
function groupCatchUps(rows: TxRow[]): TxJson[] {
  const out: TxJson[] = [];
  const catchUps = new Map<string, { tx: TxJson; count: number }>();
  for (const r of rows) {
    if (r.kind === CATCH_UP_KIND) {
      const group = catchUps.get(r.created_at);
      if (group) {
        group.count += 1;
        group.tx.amount = Math.round((group.tx.amount + r.amount) * 100) / 100;
        group.tx.reason = `Rate change catch-up (${group.count} paid items)`;
        continue;
      }
      const tx = { id: r.id, amount: r.amount, reason: `Rate change catch-up: ${r.reason}`, subject: null, type: null, createdAt: r.created_at };
      catchUps.set(r.created_at, { tx, count: 1 });
      out.push(tx);
      continue;
    }
    out.push({ id: r.id, amount: r.amount, reason: r.reason, subject: r.subject, type: r.type, createdAt: r.created_at });
  }
  return out;
}
