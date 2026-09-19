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
// shows one number while the ledger records another — so pin them together for the default settings.
describe("browser rules match the server's ledger rules (default settings)", () => {
  const HOUSE: FullRewardSettings = {
    assignmentReward: 3, testReward: 20, passingThreshold: 70, makeupWindowDays: 7,
    holdback: 20, rewardType: "money", payoutSchedule: "request",
  };

  const grades = [0, 1, 50, 69, 69.99, 70, 70.01, 85, 100];
  const types = ["assignment", "quiz", "test"] as const;

  it.each(types.flatMap(type => grades.map(grade => [type, grade] as const)))("%s @ %s%%", (type, grade) => {
    const shown = getRewardStatus(make({ type, grade })).earned;
    const ledger = computeAssignmentReward({ type, status: "graded", grade, title: "T" }, HOUSE)?.amount ?? 0; // no entry == $0
    expect(shown).toBe(ledger);
  });

  it.each(types)("%s: missing agrees", type => {
    expect(getRewardStatus(make({ type, status: "missing", grade: null })).earned).toBe(
      computeAssignmentReward({ type, status: "missing", grade: null, title: "T" }, HOUSE)?.amount ?? 0,
    );
  });
});
