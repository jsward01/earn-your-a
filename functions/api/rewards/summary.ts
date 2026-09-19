import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { resolveStudentId } from "../../_lib/students";
import { getFullRewardSettings, getBalance } from "../../_lib/rewards";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
  const { studentId } = resolved;

  const studentRow = await context.env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(studentId).first<{ name: string }>();
  const settings = await getFullRewardSettings(context.env.DB, user.familyId);
  const balance = await getBalance(context.env.DB, studentId);
  const available = Math.max(0, balance - settings.holdback);

  const pendingPayout = await context.env.DB
    .prepare("SELECT id FROM payout_requests WHERE student_id = ? AND status = 'pending' LIMIT 1")
    .bind(studentId)
    .first<{ id: string }>();

  return json(
    {
      studentId,
      studentName: studentRow?.name ?? "Student",
      balance,
      holdback: settings.holdback,
      available,
      rewardType: settings.rewardType,
      payoutPending: !!pendingPayout,
      pendingPayoutId: pendingPayout?.id ?? null,
    },
    200,
  );
};
