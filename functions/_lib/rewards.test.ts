import { describe, expect, it } from "vitest";
import { computeAssignmentReward, type FullRewardSettings } from "./rewards";

// The family's agreed house rules (see CLAUDE.md "Locked-In House Rules").
const HOUSE: FullRewardSettings = {
  assignmentReward: 3,
  testReward: 20,
  passingThreshold: 70,
  makeupWindowDays: 7,
  holdback: 20,
  rewardType: "money",
  payoutSchedule: "request",
};

type Type = "assignment" | "quiz" | "test";
const graded = (type: Type, grade: number | null) => ({ type, status: "graded" as const, grade, title: "T" });

describe("computeAssignmentReward — house rules", () => {
  describe("regular assignments: $3 at >=70%, otherwise nothing", () => {
    it.each([
      [100, 3],
      [95, 3],
      [70, 3], // the threshold itself passes
    ])("grade %i earns +$%i", (grade, amount) => {
      expect(computeAssignmentReward(graded("assignment", grade), HOUSE)).toEqual({ amount, reason: "T" });
    });

    it.each([69, 69.99, 50, 0])("grade %s earns nothing (no ledger entry, and never a penalty)", grade => {
      expect(computeAssignmentReward(graded("assignment", grade), HOUSE)).toBeNull();
    });
  });

  describe.each(["test", "quiz"] as const)("%ss: +$20 at >=70%, -$20 below", type => {
    it.each([100, 90, 70])("grade %i earns +$20", grade => {
      expect(computeAssignmentReward(graded(type, grade), HOUSE)).toEqual({ amount: 20, reason: "T" });
    });

    it.each([69, 69.99, 50, 0])("grade %s costs -$20", grade => {
      expect(computeAssignmentReward(graded(type, grade), HOUSE)).toEqual({ amount: -20, reason: "T" });
    });
  });

  it("a test and a quiz are treated identically", () => {
    for (const grade of [0, 69, 70, 100]) {
      expect(computeAssignmentReward(graded("quiz", grade), HOUSE)).toEqual(computeAssignmentReward(graded("test", grade), HOUSE));
    }
  });

  describe("nothing is paid or charged until the work is graded", () => {
    it.each(["assignment", "quiz", "test"] as const)("%s: pending -> null", type => {
      expect(computeAssignmentReward({ type, status: "pending", grade: null, title: "T" }, HOUSE)).toBeNull();
    });

    // House rule: missing work earns $0. The -$20 applies to graded-but-failing tests only.
    it.each(["assignment", "quiz", "test"] as const)("%s: missing -> null (no penalty)", type => {
      expect(computeAssignmentReward({ type, status: "missing", grade: null, title: "T" }, HOUSE)).toBeNull();
    });

    it("graded with no grade entered -> null", () => {
      expect(computeAssignmentReward(graded("test", null), HOUSE)).toBeNull();
    });

    it("a stale grade on a missing/pending item is ignored", () => {
      expect(computeAssignmentReward({ type: "test", status: "missing", grade: 10, title: "T" }, HOUSE)).toBeNull();
      expect(computeAssignmentReward({ type: "test", status: "pending", grade: 90, title: "T" }, HOUSE)).toBeNull();
    });
  });

  it("the ledger reason is the assignment title", () => {
    expect(computeAssignmentReward({ type: "test", status: "graded", grade: 88, title: "Unit 4 Test" }, HOUSE)?.reason).toBe("Unit 4 Test");
  });
});

describe("computeAssignmentReward — parent-configured settings", () => {
  it("uses the configured amounts, not $3/$20", () => {
    const s = { ...HOUSE, assignmentReward: 5, testReward: 35 };
    expect(computeAssignmentReward(graded("assignment", 80), s)?.amount).toBe(5);
    expect(computeAssignmentReward(graded("test", 80), s)?.amount).toBe(35);
    expect(computeAssignmentReward(graded("test", 10), s)?.amount).toBe(-35);
  });

  it("uses the configured passing threshold on both sides of it", () => {
    const s = { ...HOUSE, passingThreshold: 80 };
    expect(computeAssignmentReward(graded("assignment", 79), s)).toBeNull();
    expect(computeAssignmentReward(graded("assignment", 80), s)?.amount).toBe(3);
    expect(computeAssignmentReward(graded("test", 79), s)?.amount).toBe(-20);
    expect(computeAssignmentReward(graded("test", 80), s)?.amount).toBe(20);
  });

  it("a $0 test reward yields +0 / -0 rather than crashing", () => {
    const s = { ...HOUSE, testReward: 0 };
    expect(computeAssignmentReward(graded("test", 90), s)?.amount).toBe(0);
    expect(Math.abs(computeAssignmentReward(graded("test", 10), s)!.amount)).toBe(0);
  });
});
