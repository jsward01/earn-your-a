import { describe, expect, it } from "vitest";
import type { Assignment } from "../../src/types";
import { getRewardStatus } from "../../src/lib/rewards";
import { computeAssignmentReward, type FullRewardSettings } from "./rewards";

// Lives under functions/ (not src/) because it needs both the browser rules and the server's
// Cloudflare-typed module; importing the server file from src/ breaks the browser build's types.
const make = (over: Partial<Assignment>): Assignment => ({
  id: "a1", title: "T", subject: "Math", type: "assignment", dueDate: "2026-03-10",
  status: "graded", grade: 90, daysLeft: null, ...over,
});

// The browser and the server each implement the house rules. If they ever disagree, the screen
// shows one number while the ledger records another — so pin them together, for the defaults AND
// for the parent-configured amounts/pass marks that used to make them drift apart.
type Rules = Pick<
  FullRewardSettings,
  "assignmentReward" | "quizReward" | "testReward" | "assignmentPenalty" | "quizPenalty" | "testPenalty" | "passingThreshold"
>;
const RULE_SETS: [string, Rules][] = [
  ["house defaults ($3 / $10 / $20, penalties $0 / $10 / $20, 70%)", { assignmentReward: 3, quizReward: 10, testReward: 20, assignmentPenalty: 0, quizPenalty: 10, testPenalty: 20, passingThreshold: 70 }],
  ["custom ($5 / $15 / $35 / 80%)", { assignmentReward: 5, quizReward: 15, testReward: 35, assignmentPenalty: 0, quizPenalty: 15, testPenalty: 35, passingThreshold: 80 }],
  ["penalties differ from rewards", { assignmentReward: 3, quizReward: 10, testReward: 20, assignmentPenalty: 1, quizPenalty: 4, testPenalty: 8, passingThreshold: 70 }],
  ["no penalties at all", { assignmentReward: 3, quizReward: 10, testReward: 20, assignmentPenalty: 0, quizPenalty: 0, testPenalty: 0, passingThreshold: 70 }],
  ["fractional ($2.50 / $7.50 / $12.50 / 65%)", { assignmentReward: 2.5, quizReward: 7.5, testReward: 12.5, assignmentPenalty: 0.5, quizPenalty: 2.25, testPenalty: 12.5, passingThreshold: 65 }],
  ["strict (100% pass mark)", { assignmentReward: 3, quizReward: 10, testReward: 20, assignmentPenalty: 0, quizPenalty: 10, testPenalty: 20, passingThreshold: 100 }],
  ["zero amounts", { assignmentReward: 0, quizReward: 0, testReward: 0, assignmentPenalty: 0, quizPenalty: 0, testPenalty: 0, passingThreshold: 70 }],
];

const BASE: FullRewardSettings = {
  assignmentReward: 3, quizReward: 10, testReward: 20, assignmentPenalty: 0, quizPenalty: 10, testPenalty: 20, penalizeMissing: false, passingThreshold: 70, makeupWindowDays: 7,
  holdback: 20, holdbackType: "amount", rewardType: "money", payoutSchedule: "request",
};

const grades = [0, 1, 50, 64.99, 65, 69, 69.99, 70, 70.01, 79.99, 80, 85, 99.99, 100];
const types = ["assignment", "quiz", "test"] as const;

describe.each(RULE_SETS)("browser rules match the server's ledger rules — %s", (_name, rules) => {
  const settings: FullRewardSettings = { ...BASE, ...rules };

  it.each(types.flatMap(type => grades.map(grade => [type, grade] as const)))("%s @ %s%%", (type, grade) => {
    const shown = getRewardStatus(make({ type, grade }), { ...rules, penalizeMissing: false, rewardType: "money", customUnit: "" }).earned;
    const ledger = computeAssignmentReward({ type, status: "graded", grade, title: "T" }, settings)?.amount ?? 0; // no entry == $0
    // `+ 0` normalizes -0 (a "-$0" penalty with a $0 test amount) so it compares equal to 0.
    expect((shown ?? 0) + 0).toBe(ledger + 0);
  });

  it.each(types.flatMap(type => [0, 69, 70, 100].map(grade => [type, grade] as const)))("history %s at %d percent pays nothing", (type, grade) => {
    const shown = getRewardStatus(make({ type, grade, historyOnly: true }), { ...rules, penalizeMissing: false, rewardType: "money", customUnit: "" }).earned;
    const ledger = computeAssignmentReward({ type, status: "graded", grade, title: "T", historyOnly: true }, settings)?.amount ?? 0;
    expect((shown ?? 0) + 0).toBe(ledger + 0);
  });

  it.each(types.flatMap(type => [false, true].map(penalizeMissing => [type, penalizeMissing] as const)))("%s: missing agrees (missing penalty %s)", (type, penalizeMissing) => {
    const shown = getRewardStatus(make({ type, status: "missing", grade: null }), { ...rules, penalizeMissing, rewardType: "money", customUnit: "" }).earned;
    const ledger = computeAssignmentReward({ type, status: "missing", grade: null, title: "T" }, { ...settings, penalizeMissing })?.amount ?? 0;
    expect((shown ?? 0) + 0).toBe(ledger + 0);
  });
});
