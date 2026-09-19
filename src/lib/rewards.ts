import type { Assignment, AssignmentType, RewardSettings, RewardStatus } from "../types";

/** The family's house defaults. The server falls back to the same numbers when a family has no saved row. */
export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
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

/** The part of the settings that decides what an item pays and what counts as passing. */
export type RewardRules = Pick<RewardSettings, "assignmentReward" | "testReward" | "passingThreshold">;

export const HOUSE_RULES: RewardRules = {
  assignmentReward: DEFAULT_REWARD_SETTINGS.assignmentReward,
  testReward: DEFAULT_REWARD_SETTINGS.testReward,
  passingThreshold: DEFAULT_REWARD_SETTINGS.passingThreshold,
};

/** What an on-time, passing item of this type pays (tests and quizzes share one amount). */
export function rewardAmountFor(type: AssignmentType, rules: RewardRules): number {
  return type === "assignment" ? rules.assignmentReward : rules.testReward;
}

/** "$3" for whole amounts, "$2.50" otherwise. */
export function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * House reward rules (amounts and pass mark come from the family's Settings; the defaults are $3 / $20 / 70%):
 * - Regular assignments: the assignment amount if >= the pass mark, otherwise $0.
 * - Tests/quizzes: +the test amount if >= the pass mark, otherwise -the test amount (reversible via makeup window).
 * - Missing work earns $0 with no negative penalty (the penalty applies to
 *   graded-but-failing tests/quizzes only).
 *
 * This is the UI's copy of the rules; the ledger's copy is `computeAssignmentReward` in
 * functions/_lib/rewards.ts. functions/_lib/rewards.parity.test.ts keeps the two in agreement.
 */
export function getRewardStatus(a: Assignment, rules: RewardRules = HOUSE_RULES): RewardStatus {
  const { type, status, grade, daysLeft } = a;
  const passed = grade !== null && grade >= rules.passingThreshold;

  if (status === "missing") return { earned: 0, label: "Missing", color: "text-red-500" };
  if (status === "pending") return { earned: null, label: "Pending", color: "text-gray-400" };

  if (type === "assignment") {
    if (passed) return { earned: rules.assignmentReward, label: `+$${rules.assignmentReward.toFixed(2)}`, color: "text-green-500" };
    return { earned: 0, label: "$0.00", color: "text-gray-400" };
  }

  if (type === "test" || type === "quiz") {
    const amount = rules.testReward;
    if (passed) return { earned: amount, label: `+$${amount.toFixed(2)}`, color: "text-green-500" };
    if (daysLeft !== null && daysLeft > 0) return { earned: -amount, label: `-$${amount.toFixed(2)} (Makeup Available)`, color: "text-orange-500" };
    return { earned: -amount, label: `-$${amount.toFixed(2)}`, color: "text-red-500" };
  }

  return { earned: 0, label: "$0.00", color: "text-gray-400" };
}
