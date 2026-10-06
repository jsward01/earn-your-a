export interface FullRewardSettings {
  assignmentReward: number;
  quizReward: number;
  testReward: number;
  /** What finishing BELOW the pass mark costs, per kind of work (0 = no penalty). */
  assignmentPenalty: number;
  quizPenalty: number;
  testPenalty: number;
  passingThreshold: number;
  makeupWindowDays: number;
  /** A fixed amount, or a percentage of the balance, depending on holdbackType. */
  holdback: number;
  holdbackType: HoldbackType;
  rewardType: "money" | "screen" | "points" | "custom";
  payoutSchedule: "request" | "monthly" | "manual";
}

export type HoldbackType = "amount" | "percent";

interface RewardSettingsRow {
  assignment_reward: number;
  quiz_reward: number;
  test_reward: number;
  assignment_penalty: number;
  quiz_penalty: number;
  test_penalty: number;
  passing_threshold: number;
  makeup_window_days: number;
  holdback: number;
  holdback_type: HoldbackType;
  reward_type: FullRewardSettings["rewardType"];
  payout_schedule: FullRewardSettings["payoutSchedule"];
}

const DEFAULT_SETTINGS: FullRewardSettings = {
  assignmentReward: 3,
  quizReward: 10,
  testReward: 20,
  assignmentPenalty: 0,
  quizPenalty: 10,
  testPenalty: 20,
  passingThreshold: 70,
  makeupWindowDays: 7,
  holdback: 20,
  holdbackType: "amount",
  rewardType: "money",
  payoutSchedule: "request",
};

export async function getFullRewardSettings(db: D1Database, familyId: string): Promise<FullRewardSettings> {
  const row = await db
    .prepare(
      `SELECT assignment_reward, quiz_reward, test_reward, assignment_penalty, quiz_penalty, test_penalty, passing_threshold, makeup_window_days, holdback, holdback_type, reward_type, payout_schedule
       FROM reward_settings WHERE family_id = ?`,
    )
    .bind(familyId)
    .first<RewardSettingsRow>();
  if (!row) return DEFAULT_SETTINGS;
  return {
    assignmentReward: row.assignment_reward,
    quizReward: row.quiz_reward,
    testReward: row.test_reward,
    assignmentPenalty: row.assignment_penalty,
    quizPenalty: row.quiz_penalty,
    testPenalty: row.test_penalty,
    passingThreshold: row.passing_threshold,
    makeupWindowDays: row.makeup_window_days,
    holdback: row.holdback,
    holdbackType: row.holdback_type ?? "amount",
    rewardType: row.reward_type,
    payoutSchedule: row.payout_schedule,
  };
}

const roundCents = (n: number): number => Math.round(n * 100) / 100;

/**
 * How much of `balance` is held back against upcoming penalties. A fixed amount is held back as-is (even when the
 * balance is smaller, which just leaves nothing available); a percentage is taken of the current balance, rounded
 * to the cent, and is zero when the balance is zero or negative.
 */
export function holdbackFor(balance: number, s: Pick<FullRewardSettings, "holdback" | "holdbackType">): number {
  if (s.holdbackType === "percent") return roundCents((Math.max(0, balance) * s.holdback) / 100);
  return s.holdback;
}

/** What a payout request may ask for: the balance minus the holdback, never below zero. */
export function availableFor(balance: number, s: Pick<FullRewardSettings, "holdback" | "holdbackType">): number {
  return Math.max(0, roundCents(balance - holdbackFor(balance, s)));
}

interface AssignmentForReward {
  type: "assignment" | "quiz" | "test";
  status: "pending" | "graded" | "missing";
  grade: number | null;
  title: string;
  /** Work from before the student's rewards started: recorded, never priced. */
  historyOnly?: boolean;
}

/**
 * House rules (mirrors src/lib/rewards.ts's getRewardStatus, but driven by the family's configured amounts):
 * - At or above the pass mark: +the reward for that kind of work (assignment / quiz / test each have their own).
 * - Below the pass mark: -the penalty for that kind of work. Regular assignments default to a $0 penalty, so a
 *   failing assignment leaves no ledger entry; quizzes and tests default to losing what they would have paid.
 *   A penalty is reversible: once a retake passes, re-syncing replaces it with the reward.
 * - Missing or ungraded work never has a ledger entry.
 * - History work (due before the student's rewards started) never has a ledger entry.
 */
export function computeAssignmentReward(
  a: AssignmentForReward,
  settings: FullRewardSettings,
): { amount: number; reason: string } | null {
  if (a.historyOnly || a.status !== "graded" || a.grade === null) return null;

  const reward = a.type === "assignment" ? settings.assignmentReward : a.type === "quiz" ? settings.quizReward : settings.testReward;
  const penalty = a.type === "assignment" ? settings.assignmentPenalty : a.type === "quiz" ? settings.quizPenalty : settings.testPenalty;

  if (a.grade >= settings.passingThreshold) return { amount: reward, reason: a.title };
  return penalty > 0 ? { amount: -penalty, reason: a.title } : null;
}

/**
 * Reconciles the single reward_transactions row tied to this assignment with
 * its current graded state: delete whatever was there, insert the fresh
 * amount (if any). Keeps the ledger a pure function of "current assignment
 * state" for assignment-linked entries, while payout entries (no assignment_id)
 * are untouched.
 */
export async function syncAssignmentRewardTransaction(
  db: D1Database,
  ctx: { assignmentId: string; familyId: string; studentId: string },
  assignment: AssignmentForReward,
  settings: FullRewardSettings,
): Promise<void> {
  await db.prepare("DELETE FROM reward_transactions WHERE assignment_id = ?").bind(ctx.assignmentId).run();

  const reward = computeAssignmentReward(assignment, settings);
  if (!reward) return;

  await db
    .prepare(
      `INSERT INTO reward_transactions (id, family_id, student_id, assignment_id, amount, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), ctx.familyId, ctx.studentId, ctx.assignmentId, reward.amount, reward.reason)
    .run();
}

export async function getBalance(db: D1Database, studentId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) as balance FROM reward_transactions WHERE student_id = ?")
    .bind(studentId)
    .first<{ balance: number }>();
  return row?.balance ?? 0;
}
