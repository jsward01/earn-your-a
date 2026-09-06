export interface FullRewardSettings {
  assignmentReward: number;
  testReward: number;
  passingThreshold: number;
  makeupWindowDays: number;
  holdback: number;
  rewardType: "money" | "screen" | "points" | "custom";
  payoutSchedule: "request" | "monthly" | "manual";
}

interface RewardSettingsRow {
  assignment_reward: number;
  test_reward: number;
  passing_threshold: number;
  makeup_window_days: number;
  holdback: number;
  reward_type: FullRewardSettings["rewardType"];
  payout_schedule: FullRewardSettings["payoutSchedule"];
}

const DEFAULT_SETTINGS: FullRewardSettings = {
  assignmentReward: 3,
  testReward: 20,
  passingThreshold: 70,
  makeupWindowDays: 7,
  holdback: 20,
  rewardType: "money",
  payoutSchedule: "request",
};

export async function getFullRewardSettings(db: D1Database, familyId: string): Promise<FullRewardSettings> {
  const row = await db
    .prepare(
      `SELECT assignment_reward, test_reward, passing_threshold, makeup_window_days, holdback, reward_type, payout_schedule
       FROM reward_settings WHERE family_id = ?`,
    )
    .bind(familyId)
    .first<RewardSettingsRow>();
  if (!row) return DEFAULT_SETTINGS;
  return {
    assignmentReward: row.assignment_reward,
    testReward: row.test_reward,
    passingThreshold: row.passing_threshold,
    makeupWindowDays: row.makeup_window_days,
    holdback: row.holdback,
    rewardType: row.reward_type,
    payoutSchedule: row.payout_schedule,
  };
}

interface AssignmentForReward {
  type: "assignment" | "quiz" | "test";
  status: "pending" | "graded" | "missing";
  grade: number | null;
  title: string;
}

/**
 * House rules (mirrors src/lib/rewards.ts's getRewardStatus, but driven by the
 * family's configured amounts instead of hardcoded $3/$20): missing work and
 * failing regular assignments earn $0 with no ledger entry; only failing
 * tests/quizzes carry a negative entry, reversible by re-syncing once a
 * retake passes.
 */
export function computeAssignmentReward(
  a: AssignmentForReward,
  settings: FullRewardSettings,
): { amount: number; reason: string } | null {
  if (a.status !== "graded" || a.grade === null) return null;

  if (a.type === "assignment") {
    if (a.grade >= settings.passingThreshold) return { amount: settings.assignmentReward, reason: a.title };
    return null;
  }

  if (a.grade >= settings.passingThreshold) return { amount: settings.testReward, reason: a.title };
  return { amount: -settings.testReward, reason: a.title };
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
