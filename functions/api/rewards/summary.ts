import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { getStudentId } from "../../_lib/assignments";
import { getFullRewardSettings, getBalance } from "../../_lib/rewards";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const studentId = await getStudentId(context.env.DB, user.familyId);
  if (!studentId) return json({ error: "No student found for this family" }, 400);

  const studentRow = await context.env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(studentId).first<{ name: string }>();
  const settings = await getFullRewardSettings(context.env.DB, user.familyId);
  const balance = await getBalance(context.env.DB, studentId);
  const available = Math.max(0, balance - settings.holdback);

  const pendingPayout = await context.env.DB
    .prepare("SELECT id FROM payout_requests WHERE family_id = ? AND status = 'pending' LIMIT 1")
    .bind(user.familyId)
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
