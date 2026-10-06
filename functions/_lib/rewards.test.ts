import { describe, expect, it } from "vitest";
import { availableFor, computeAssignmentReward, holdbackFor, type FullRewardSettings } from "./rewards";

// The family's agreed house rules (see CLAUDE.md "Locked-In House Rules").
const HOUSE: FullRewardSettings = {
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

  describe("tests: +$20 at >=70%, -$20 below", () => {
    it.each([100, 90, 70])("grade %i earns +$20", grade => {
      expect(computeAssignmentReward(graded("test", grade), HOUSE)).toEqual({ amount: 20, reason: "T" });
    });

    it.each([69, 69.99, 50, 0])("grade %s costs -$20", grade => {
      expect(computeAssignmentReward(graded("test", grade), HOUSE)).toEqual({ amount: -20, reason: "T" });
    });
  });

  describe("quizzes: +$10 at >=70%, -$10 below (their own amount, no longer the test's)", () => {
    it.each([100, 90, 70])("grade %i earns +$10", grade => {
      expect(computeAssignmentReward(graded("quiz", grade), HOUSE)).toEqual({ amount: 10, reason: "T" });
    });

    it.each([69, 69.99, 50, 0])("grade %s costs -$10", grade => {
      expect(computeAssignmentReward(graded("quiz", grade), HOUSE)).toEqual({ amount: -10, reason: "T" });
    });
  });

  describe("penalties are their own settings, separate from the rewards", () => {
    it("a penalty can differ from the reward (quiz pays $10 but costs $4; test pays $20 but costs $0)", () => {
      const s = { ...HOUSE, quizPenalty: 4, testPenalty: 0 };
      expect(computeAssignmentReward(graded("quiz", 50), s)).toEqual({ amount: -4, reason: "T" });
      expect(computeAssignmentReward(graded("quiz", 90), s)).toEqual({ amount: 10, reason: "T" });
      expect(computeAssignmentReward(graded("test", 50), s)).toBeNull(); // $0 penalty: no ledger entry
      expect(computeAssignmentReward(graded("test", 90), s)).toEqual({ amount: 20, reason: "T" });
    });

    it("a regular assignment can be given a penalty; the default is none", () => {
      expect(computeAssignmentReward(graded("assignment", 50), { ...HOUSE, assignmentPenalty: 1.5 })).toEqual({ amount: -1.5, reason: "T" });
      expect(computeAssignmentReward(graded("assignment", 50), HOUSE)).toBeNull();
    });

    it("changing one type's amounts never moves another's", () => {
      const s = { ...HOUSE, quizReward: 99, quizPenalty: 99, assignmentReward: 77, assignmentPenalty: 77 };
      expect(computeAssignmentReward(graded("test", 90), s)?.amount).toBe(20);
      expect(computeAssignmentReward(graded("test", 10), s)?.amount).toBe(-20);
    });

    it("the pass mark still decides which side of the line a grade lands on", () => {
      const s = { ...HOUSE, passingThreshold: 80 };
      expect(computeAssignmentReward(graded("quiz", 79), s)?.amount).toBe(-10);
      expect(computeAssignmentReward(graded("quiz", 80), s)?.amount).toBe(10);
    });
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
    const s = { ...HOUSE, assignmentReward: 5, testReward: 35, testPenalty: 35 };
    expect(computeAssignmentReward(graded("assignment", 80), s)?.amount).toBe(5);
    expect(computeAssignmentReward(graded("test", 80), s)?.amount).toBe(35);
    expect(computeAssignmentReward(graded("test", 10), s)?.amount).toBe(-35);
    // raising a reward does not raise its penalty: they are separate settings
    expect(computeAssignmentReward(graded("test", 10), { ...HOUSE, testReward: 35 })?.amount).toBe(-20);
  });

  it("uses the configured passing threshold on both sides of it", () => {
    const s = { ...HOUSE, passingThreshold: 80 };
    expect(computeAssignmentReward(graded("assignment", 79), s)).toBeNull();
    expect(computeAssignmentReward(graded("assignment", 80), s)?.amount).toBe(3);
    expect(computeAssignmentReward(graded("test", 79), s)?.amount).toBe(-20);
    expect(computeAssignmentReward(graded("test", 80), s)?.amount).toBe(20);
  });

  it("a $0 test reward pays 0, and a $0 penalty leaves no entry, rather than crashing", () => {
    const s = { ...HOUSE, testReward: 0, testPenalty: 0 };
    expect(computeAssignmentReward(graded("test", 90), s)?.amount).toBe(0);
    expect(computeAssignmentReward(graded("test", 10), s)).toBeNull();
  });
});

describe("holdbackFor / availableFor — fixed amount or percentage of the balance", () => {
  const amount = (holdback: number) => ({ holdback, holdbackType: "amount" as const });
  const percent = (holdback: number) => ({ holdback, holdbackType: "percent" as const });

  it("a fixed amount is held back as-is", () => {
    expect(holdbackFor(119, amount(20))).toBe(20);
    expect(availableFor(119, amount(20))).toBe(99);
  });

  it("a fixed amount larger than the balance leaves nothing available (never negative)", () => {
    expect(availableFor(15, amount(20))).toBe(0);
    expect(availableFor(-5, amount(20))).toBe(0);
  });

  it("a percentage is taken of the current balance, to the cent", () => {
    expect(holdbackFor(119, percent(20))).toBe(23.8);
    expect(availableFor(119, percent(20))).toBe(95.2);
    expect(holdbackFor(33.33, percent(10))).toBe(3.33); // 3.333 rounds down
    expect(holdbackFor(0.05, percent(10))).toBe(0.01); // 0.005 rounds up
  });

  it("0% holds nothing back and 100% holds everything back", () => {
    expect(availableFor(119, percent(0))).toBe(119);
    expect(availableFor(119, percent(100))).toBe(0);
  });

  it("a percentage of a zero or negative balance is zero and nothing is available", () => {
    expect(holdbackFor(0, percent(20))).toBe(0);
    expect(holdbackFor(-40, percent(20))).toBe(0);
    expect(availableFor(-40, percent(20))).toBe(0);
  });

  it("available + holdback always adds back to the balance (no cent is lost or invented)", () => {
    for (const bal of [0.01, 1, 9.99, 33.33, 119, 250.55]) {
      for (const pct of [1, 7, 12.5, 20, 33, 99]) {
        const h = holdbackFor(bal, percent(pct));
        expect(Math.round((availableFor(bal, percent(pct)) + h) * 100) / 100).toBe(bal);
      }
    }
  });
});

describe("computeAssignmentReward — history work (before the student's rewards started)", () => {
  it.each([
    ["assignment", 100], ["assignment", 10], ["quiz", 95], ["quiz", 20], ["test", 90], ["test", 0],
  ] as const)("%s @ %s%% earns and costs nothing", (type, grade) => {
    expect(computeAssignmentReward({ ...graded(type, grade), historyOnly: true }, HOUSE)).toBeNull();
  });

  it("the same work without the mark is priced normally", () => {
    expect(computeAssignmentReward({ ...graded("test", 0), historyOnly: false }, HOUSE)).toEqual({ amount: -20, reason: "T" });
  });
});
