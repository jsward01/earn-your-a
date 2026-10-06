import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { resolveStudentId } from "../../_lib/students";
import { getFullRewardSettings, getBalance, holdbackFor, availableFor } from "../../_lib/rewards";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
  const { studentId } = resolved;

  const studentRow = await context.env.DB
    .prepare("SELECT name, avatar, rewards_start_date FROM users WHERE id = ?")
    .bind(studentId)
    .first<{ name: string; avatar: string | null; rewards_start_date: string | null }>();
  const settings = await getFullRewardSettings(context.env.DB, user.familyId);
  const balance = await getBalance(context.env.DB, studentId);
  const holdback = holdbackFor(balance, settings);
  const available = availableFor(balance, settings);

  const pendingPayout = await context.env.DB
    .prepare("SELECT id FROM payout_requests WHERE student_id = ? AND status = 'pending' LIMIT 1")
    .bind(studentId)
    .first<{ id: string }>();

  return json(
    {
      studentId,
      studentName: studentRow?.name ?? "Student",
      studentAvatar: studentRow?.avatar ?? null,
      // When rewards started for this student (null = never set: the first grade import asks).
      rewardsStartDate: studentRow?.rewards_start_date ?? null,
      balance,
      holdback,
      // The setting behind it, so screens can say "20% of your balance" instead of just the amount.
      holdbackType: settings.holdbackType,
      holdbackSetting: settings.holdback,
      available,
      rewardType: settings.rewardType,
      payoutPending: !!pendingPayout,
      pendingPayoutId: pendingPayout?.id ?? null,
    },
    200,
  );
};
