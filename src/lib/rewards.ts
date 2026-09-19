import type { Assignment, AssignmentType, RewardSettings, RewardStatus } from "../types";

/** The family's house defaults. The server falls back to the same numbers when a family has no saved row. */
export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  assignmentReward: 3,
  testReward: 20,
  passingThreshold: 70,
  makeupWindow: 7,
  holdback: 20,
  rewardType: "money",
  customUnit: "",
  excellenceBonus: true,
  streakBonus: true,
  payoutSchedule: "request",
};

/** How an amount is written: which kind of reward, and (for "custom") the family's own word for it. */
export type RewardFormat = Pick<RewardSettings, "rewardType" | "customUnit">;

/** What an item pays and what counts as passing, plus how to write the amount. */
export type RewardRules = Pick<RewardSettings, "assignmentReward" | "testReward" | "passingThreshold" | "rewardType" | "customUnit">;

export const HOUSE_RULES: RewardRules = {
  assignmentReward: DEFAULT_REWARD_SETTINGS.assignmentReward,
  testReward: DEFAULT_REWARD_SETTINGS.testReward,
  passingThreshold: DEFAULT_REWARD_SETTINGS.passingThreshold,
  rewardType: DEFAULT_REWARD_SETTINGS.rewardType,
  customUnit: DEFAULT_REWARD_SETTINGS.customUnit,
};

/** What an on-time, passing item of this type pays (tests and quizzes share one amount). */
export function rewardAmountFor(type: AssignmentType, rules: RewardRules): number {
  return type === "assignment" ? rules.assignmentReward : rules.testReward;
}

/** The unit word for non-money rewards: "min", "pts", or the family's own word. Money has none (it's a "$" prefix). */
export function unitWord(fmt: RewardFormat, amount = 2): string {
  switch (fmt.rewardType) {
    case "screen": return "min";
    case "points": return amount === 1 ? "pt" : "pts";
    case "custom": return fmt.customUnit.trim() || "units";
    default: return "";
  }
}

export interface FormatOptions {
  /** Always show "+" for gains ("-" for losses shows either way). */
  signed?: boolean;
  /** Whole amounts without decimals ("$3" not "$3.00"). Ignored for non-money rewards, which are always trimmed. */
  short?: boolean;
}

/**
 * Write an amount in the family's reward unit:
 *   money "$5.00" · screen time "30 min" · points "5 pts" · custom "5 stars".
 * Amounts are rounded to cents first so float noise (0.1 + 0.2) never shows up on screen.
 */
export function formatAmount(amount: number, fmt: RewardFormat, opts: FormatOptions = {}): string {
  const rounded = Math.round(amount * 100) / 100;
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? "-" : opts.signed && rounded > 0 ? "+" : "";

  if (fmt.rewardType === "money") {
    return `${sign}$${opts.short && Number.isInteger(abs) ? abs : abs.toFixed(2)}`;
  }
  const num = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${sign}${num} ${unitWord(fmt, abs)}`;
}

/**
 * House reward rules (amounts and pass mark come from the family's Settings; the defaults are $3 / $20 / 70%):
 * - Regular assignments: the assignment amount if >= the pass mark, otherwise nothing.
 * - Tests/quizzes: +the test amount if >= the pass mark, otherwise -the test amount (reversible via makeup window).
 * - Missing work earns nothing with no negative penalty (the penalty applies to
 *   graded-but-failing tests/quizzes only).
 *
 * Graded items that carry `recordedReward` (everything from the API) use that instead of the rules below; the rules
 * still drive previews and anything not yet recorded.
 *
 * This is the UI's copy of the rules; the ledger's copy is `computeAssignmentReward` in
 * functions/_lib/rewards.ts. functions/_lib/rewards.parity.test.ts keeps the two in agreement.
 */
export function getRewardStatus(a: Assignment, rules: RewardRules = HOUSE_RULES): RewardStatus {
  const { type, status, grade, daysLeft } = a;
  const passed = grade !== null && grade >= rules.passingThreshold;
  const gain = (n: number) => formatAmount(n, rules, { signed: true });
  const makeup = (n: number) => (daysLeft !== null && daysLeft > 0 ? `${formatAmount(n, rules)} (Makeup Available)` : formatAmount(n, rules));
  const penaltyColor = daysLeft !== null && daysLeft > 0 ? "text-orange-500" : "text-red-500";

  if (status === "missing") return { earned: 0, label: "Missing", color: "text-red-500" };
  if (status === "pending") return { earned: null, label: "Pending", color: "text-gray-400" };

  // Graded work shows what the ledger actually recorded, so a card can never disagree with the reward it earned —
  // even after the family changes its reward amounts or pass mark (the ledger is history; it isn't re-priced).
  if (a.recordedReward !== undefined) {
    const amount = a.recordedReward ?? 0;
    if (amount > 0) return { earned: amount, label: gain(amount), color: "text-green-500" };
    if (amount < 0) return { earned: amount, label: makeup(amount), color: penaltyColor };
    return { earned: 0, label: formatAmount(0, rules), color: "text-gray-400" };
  }

  if (type === "assignment") {
    if (passed) return { earned: rules.assignmentReward, label: gain(rules.assignmentReward), color: "text-green-500" };
    return { earned: 0, label: formatAmount(0, rules), color: "text-gray-400" };
  }

  if (type === "test" || type === "quiz") {
    const amount = rules.testReward;
    if (passed) return { earned: amount, label: gain(amount), color: "text-green-500" };
    return { earned: -amount, label: makeup(-amount), color: penaltyColor };
  }

  return { earned: 0, label: formatAmount(0, rules), color: "text-gray-400" };
}
