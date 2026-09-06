import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { getStudentId } from "../../_lib/assignments";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface TxRow {
  id: string;
  amount: number;
  reason: string;
  assignment_id: string | null;
  created_at: string;
  subject: string | null;
  type: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const studentId = await getStudentId(context.env.DB, user.familyId);
  if (!studentId) return json([], 200);

  const { results } = await context.env.DB
    .prepare(
      `SELECT t.id, t.amount, t.reason, t.assignment_id, t.created_at, a.subject, a.type
       FROM reward_transactions t
       LEFT JOIN assignments a ON a.id = t.assignment_id
       WHERE t.student_id = ?
       ORDER BY t.created_at DESC
       LIMIT 200`,
    )
    .bind(studentId)
    .all<TxRow>();

  return json(
    results.map(r => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      subject: r.subject,
      type: r.type,
      createdAt: r.created_at,
    })),
    200,
  );
};
