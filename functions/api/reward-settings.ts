import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

type RewardType = "money" | "screen" | "points" | "custom";
type PayoutSchedule = "request" | "monthly" | "manual";

interface RewardSettingsRow {
  assignment_reward: number;
  test_reward: number;
  passing_threshold: number;
  makeup_window_days: number;
  holdback: number;
  reward_type: RewardType;
  excellence_bonus: number;
  streak_bonus: number;
  payout_schedule: PayoutSchedule;
}

interface RewardSettingsBody {
  assignmentReward: number;
  testReward: number;
  passingThreshold: number;
  makeupWindow: number;
  holdback: number;
  rewardType: RewardType;
  excellenceBonus: boolean;
  streakBonus: boolean;
  payoutSchedule: PayoutSchedule;
}

const DEFAULT_SETTINGS: RewardSettingsBody = {
  assignmentReward: 3,
  testReward: 20,
  passingThreshold: 70,
  makeupWindow: 7,
  holdback: 20,
  rewardType: "money",
  excellenceBonus: true,
  streakBonus: true,
  payoutSchedule: "request",
};

function toBody(row: RewardSettingsRow): RewardSettingsBody {
  return {
    assignmentReward: row.assignment_reward,
    testReward: row.test_reward,
    passingThreshold: row.passing_threshold,
    makeupWindow: row.makeup_window_days,
    holdback: row.holdback,
    rewardType: row.reward_type,
    excellenceBonus: !!row.excellence_bonus,
    streakBonus: !!row.streak_bonus,
    payoutSchedule: row.payout_schedule,
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const row = await context.env.DB
    .prepare(
      `SELECT assignment_reward, test_reward, passing_threshold, makeup_window_days, holdback, reward_type, excellence_bonus, streak_bonus, payout_schedule
       FROM reward_settings WHERE family_id = ?`,
    )
    .bind(user.familyId)
    .first<RewardSettingsRow>();

  return json(row ? toBody(row) : DEFAULT_SETTINGS, 200);
};

const REWARD_TYPES: RewardType[] = ["money", "screen", "points", "custom"];
const PAYOUT_SCHEDULES: PayoutSchedule[] = ["request", "monthly", "manual"];

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can change reward settings" }, 403);

  let body: Partial<RewardSettingsBody>;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const {
    assignmentReward, testReward, passingThreshold, makeupWindow, holdback,
    rewardType, excellenceBonus, streakBonus, payoutSchedule,
  } = body;

  if (
    !isFiniteNonNegative(assignmentReward) ||
    !isFiniteNonNegative(testReward) ||
    !isFiniteNonNegative(holdback) ||
    typeof passingThreshold !== "number" || !Number.isFinite(passingThreshold) || passingThreshold < 0 || passingThreshold > 100 ||
    typeof makeupWindow !== "number" || !Number.isInteger(makeupWindow) || makeupWindow < 1 ||
    !rewardType || !REWARD_TYPES.includes(rewardType) ||
    !payoutSchedule || !PAYOUT_SCHEDULES.includes(payoutSchedule) ||
    typeof excellenceBonus !== "boolean" ||
    typeof streakBonus !== "boolean"
  ) {
    return json({ error: "Invalid reward settings" }, 400);
  }

  await context.env.DB
    .prepare(
      `INSERT INTO reward_settings (family_id, assignment_reward, test_reward, passing_threshold, makeup_window_days, holdback, reward_type, excellence_bonus, streak_bonus, payout_schedule, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(family_id) DO UPDATE SET
         assignment_reward = excluded.assignment_reward,
         test_reward = excluded.test_reward,
         passing_threshold = excluded.passing_threshold,
         makeup_window_days = excluded.makeup_window_days,
         holdback = excluded.holdback,
         reward_type = excluded.reward_type,
         excellence_bonus = excluded.excellence_bonus,
         streak_bonus = excluded.streak_bonus,
         payout_schedule = excluded.payout_schedule,
         updated_at = datetime('now')`,
    )
    .bind(
      user.familyId, assignmentReward, testReward, passingThreshold, makeupWindow, holdback,
      rewardType, excellenceBonus ? 1 : 0, streakBonus ? 1 : 0, payoutSchedule,
    )
    .run();

  return json(
    { assignmentReward, testReward, passingThreshold, makeupWindow, holdback, rewardType, excellenceBonus, streakBonus, payoutSchedule },
    200,
  );
};
