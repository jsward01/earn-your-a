import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

type RewardType = "money" | "screen" | "points" | "custom";
type PayoutSchedule = "request" | "monthly" | "manual";
type HoldbackType = "amount" | "percent";

interface RewardSettingsRow {
  assignment_reward: number;
  quiz_reward: number;
  test_reward: number;
  assignment_penalty: number;
  quiz_penalty: number;
  test_penalty: number;
  missing_penalty: number;
  passing_threshold: number;
  makeup_window_days: number;
  holdback: number;
  holdback_type: HoldbackType;
  reward_type: RewardType;
  excellence_bonus: number;
  streak_bonus: number;
  payout_schedule: PayoutSchedule;
  custom_unit: string;
}

interface RewardSettingsBody {
  assignmentReward: number;
  quizReward: number;
  testReward: number;
  /** What finishing below the pass mark costs, per kind of work (0 = none). */
  assignmentPenalty: number;
  quizPenalty: number;
  testPenalty: number;
  /** Missing work costs the same as a failing grade of its type. */
  penalizeMissing: boolean;
  passingThreshold: number;
  /** Days to retake missing or failing work; 0 = retakes are off. */
  makeupWindow: number;
  /** A fixed amount, or a percentage of the balance when holdbackType is 'percent'. */
  holdback: number;
  holdbackType: HoldbackType;
  rewardType: RewardType;
  excellenceBonus: boolean;
  streakBonus: boolean;
  payoutSchedule: PayoutSchedule;
  /** Only shown when rewardType is 'custom'. */
  customUnit: string;
}

const DEFAULT_SETTINGS: RewardSettingsBody = {
  assignmentReward: 3,
  quizReward: 10,
  testReward: 20,
  assignmentPenalty: 0,
  quizPenalty: 10,
  testPenalty: 20,
  penalizeMissing: false,
  passingThreshold: 70,
  makeupWindow: 7,
  holdback: 20,
  holdbackType: "amount",
  rewardType: "money",
  excellenceBonus: true,
  streakBonus: true,
  payoutSchedule: "request",
  customUnit: "",
};

function toBody(row: RewardSettingsRow): RewardSettingsBody {
  return {
    assignmentReward: row.assignment_reward,
    quizReward: row.quiz_reward,
    testReward: row.test_reward,
    assignmentPenalty: row.assignment_penalty,
    quizPenalty: row.quiz_penalty,
    testPenalty: row.test_penalty,
    penalizeMissing: !!row.missing_penalty,
    passingThreshold: row.passing_threshold,
    makeupWindow: row.makeup_window_days,
    holdback: row.holdback,
    holdbackType: row.holdback_type ?? "amount",
    rewardType: row.reward_type,
    excellenceBonus: !!row.excellence_bonus,
    streakBonus: !!row.streak_bonus,
    payoutSchedule: row.payout_schedule,
    customUnit: row.custom_unit ?? "",
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const row = await context.env.DB
    .prepare(
      `SELECT assignment_reward, quiz_reward, test_reward, assignment_penalty, quiz_penalty, test_penalty, missing_penalty, passing_threshold, makeup_window_days, holdback, holdback_type, reward_type, excellence_bonus, streak_bonus, payout_schedule, custom_unit
       FROM reward_settings WHERE family_id = ?`,
    )
    .bind(user.familyId)
    .first<RewardSettingsRow>();

  return json(row ? toBody(row) : DEFAULT_SETTINGS, 200);
};

const REWARD_TYPES: RewardType[] = ["money", "screen", "points", "custom"];
const PAYOUT_SCHEDULES: PayoutSchedule[] = ["request", "monthly", "manual"];
const HOLDBACK_TYPES: HoldbackType[] = ["amount", "percent"];
const MAX_CUSTOM_UNIT = 20;

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
  // Optional for older clients; blank means "units" on screen.
  const customUnit = (body.customUnit ?? "").toString().trim();

  // The quiz reward and the three penalties are newer than the original settings screen. A stale page that omits
  // them must not silently reset them, so fall back to what the family already has (or the defaults).
  const current = await context.env.DB
    .prepare("SELECT quiz_reward, assignment_penalty, quiz_penalty, test_penalty, missing_penalty FROM reward_settings WHERE family_id = ?")
    .bind(user.familyId)
    .first<{ quiz_reward: number; assignment_penalty: number; quiz_penalty: number; test_penalty: number; missing_penalty: number }>();
  const quizReward = body.quizReward ?? current?.quiz_reward ?? DEFAULT_SETTINGS.quizReward;
  const assignmentPenalty = body.assignmentPenalty ?? current?.assignment_penalty ?? DEFAULT_SETTINGS.assignmentPenalty;
  const quizPenalty = body.quizPenalty ?? current?.quiz_penalty ?? DEFAULT_SETTINGS.quizPenalty;
  const testPenalty = body.testPenalty ?? current?.test_penalty ?? DEFAULT_SETTINGS.testPenalty;
  const penalizeMissing = body.penalizeMissing ?? (current ? !!current.missing_penalty : DEFAULT_SETTINGS.penalizeMissing);

  if (
    !isFiniteNonNegative(assignmentReward) ||
    !isFiniteNonNegative(testReward) ||
    !isFiniteNonNegative(quizReward) ||
    !isFiniteNonNegative(assignmentPenalty) ||
    !isFiniteNonNegative(quizPenalty) ||
    !isFiniteNonNegative(testPenalty) ||
    !isFiniteNonNegative(holdback) ||
    typeof passingThreshold !== "number" || !Number.isFinite(passingThreshold) || passingThreshold < 0 || passingThreshold > 100 ||
    typeof makeupWindow !== "number" || !Number.isInteger(makeupWindow) || makeupWindow < 0 ||
    typeof penalizeMissing !== "boolean" ||
    !rewardType || !REWARD_TYPES.includes(rewardType) ||
    !payoutSchedule || !PAYOUT_SCHEDULES.includes(payoutSchedule) ||
    typeof excellenceBonus !== "boolean" ||
    typeof streakBonus !== "boolean"
  ) {
    return json({ error: "Invalid reward settings" }, 400);
  }
  if (customUnit.length > MAX_CUSTOM_UNIT) return json({ error: `The custom unit can be at most ${MAX_CUSTOM_UNIT} characters` }, 400);

  // Optional for older clients (a stale page open in a browser): when omitted, keep whatever the family already chose.
  let holdbackType = body.holdbackType;
  if (holdbackType === undefined) {
    const current = await context.env.DB
      .prepare("SELECT holdback_type FROM reward_settings WHERE family_id = ?")
      .bind(user.familyId)
      .first<{ holdback_type: HoldbackType }>();
    holdbackType = current?.holdback_type ?? "amount";
  }
  if (!HOLDBACK_TYPES.includes(holdbackType)) return json({ error: "Invalid holdback type" }, 400);
  if (holdbackType === "percent" && holdback > 100) return json({ error: "A percentage holdback can be at most 100" }, 400);

  await context.env.DB
    .prepare(
      `INSERT INTO reward_settings (family_id, assignment_reward, quiz_reward, test_reward, assignment_penalty, quiz_penalty, test_penalty, missing_penalty, passing_threshold, makeup_window_days, holdback, holdback_type, reward_type, excellence_bonus, streak_bonus, payout_schedule, custom_unit, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(family_id) DO UPDATE SET
         assignment_reward = excluded.assignment_reward,
         quiz_reward = excluded.quiz_reward,
         test_reward = excluded.test_reward,
         assignment_penalty = excluded.assignment_penalty,
         quiz_penalty = excluded.quiz_penalty,
         test_penalty = excluded.test_penalty,
         missing_penalty = excluded.missing_penalty,
         passing_threshold = excluded.passing_threshold,
         makeup_window_days = excluded.makeup_window_days,
         holdback = excluded.holdback,
         holdback_type = excluded.holdback_type,
         reward_type = excluded.reward_type,
         excellence_bonus = excluded.excellence_bonus,
         streak_bonus = excluded.streak_bonus,
         payout_schedule = excluded.payout_schedule,
         custom_unit = excluded.custom_unit,
         updated_at = datetime('now')`,
    )
    .bind(
      user.familyId, assignmentReward, quizReward, testReward, assignmentPenalty, quizPenalty, testPenalty, penalizeMissing ? 1 : 0, passingThreshold, makeupWindow, holdback, holdbackType,
      rewardType, excellenceBonus ? 1 : 0, streakBonus ? 1 : 0, payoutSchedule, customUnit,
    )
    .run();

  return json(
    { assignmentReward, quizReward, testReward, assignmentPenalty, quizPenalty, testPenalty, penalizeMissing, passingThreshold, makeupWindow, holdback, holdbackType, rewardType, excellenceBonus, streakBonus, payoutSchedule, customUnit },
    200,
  );
};
