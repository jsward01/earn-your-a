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
const RULE_SETS: [string, Pick<FullRewardSettings, "assignmentReward" | "testReward" | "passingThreshold">][] = [
  ["house defaults ($3 / $20 / 70%)", { assignmentReward: 3, testReward: 20, passingThreshold: 70 }],
  ["custom ($5 / $35 / 80%)", { assignmentReward: 5, testReward: 35, passingThreshold: 80 }],
  ["fractional ($2.50 / $12.50 / 65%)", { assignmentReward: 2.5, testReward: 12.5, passingThreshold: 65 }],
  ["strict (100% pass mark)", { assignmentReward: 3, testReward: 20, passingThreshold: 100 }],
  ["zero amounts", { assignmentReward: 0, testReward: 0, passingThreshold: 70 }],
];

const BASE: FullRewardSettings = {
  assignmentReward: 3, testReward: 20, passingThreshold: 70, makeupWindowDays: 7,
  holdback: 20, rewardType: "money", payoutSchedule: "request",
};

const grades = [0, 1, 50, 64.99, 65, 69, 69.99, 70, 70.01, 79.99, 80, 85, 99.99, 100];
const types = ["assignment", "quiz", "test"] as const;

describe.each(RULE_SETS)("browser rules match the server's ledger rules — %s", (_name, rules) => {
  const settings: FullRewardSettings = { ...BASE, ...rules };

  it.each(types.flatMap(type => grades.map(grade => [type, grade] as const)))("%s @ %s%%", (type, grade) => {
    const shown = getRewardStatus(make({ type, grade }), rules).earned;
    const ledger = computeAssignmentReward({ type, status: "graded", grade, title: "T" }, settings)?.amount ?? 0; // no entry == $0
    // `+ 0` normalizes -0 (a "-$0" penalty with a $0 test amount) so it compares equal to 0.
    expect((shown ?? 0) + 0).toBe(ledger + 0);
  });

  it.each(types)("%s: missing agrees", type => {
    expect(getRewardStatus(make({ type, status: "missing", grade: null }), rules).earned).toBe(
      computeAssignmentReward({ type, status: "missing", grade: null, title: "T" }, settings)?.amount ?? 0,
    );
  });
});
