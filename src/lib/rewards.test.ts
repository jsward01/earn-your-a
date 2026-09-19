import { describe, expect, it } from "vitest";
import type { Assignment } from "../types";
import { DEFAULT_REWARD_SETTINGS, formatMoney, getRewardStatus, HOUSE_RULES, rewardAmountFor, type RewardRules } from "./rewards";

const make = (over: Partial<Assignment>): Assignment => ({
  id: "a1",
  title: "T",
  subject: "Math",
  type: "assignment",
  dueDate: "2026-03-10",
  status: "graded",
  grade: 90,
  daysLeft: null,
  ...over,
});

describe("getRewardStatus (what the UI shows)", () => {
  it("regular assignment >=70 shows +$3", () => {
    expect(getRewardStatus(make({ grade: 70 }))).toMatchObject({ earned: 3, label: "+$3.00" });
  });

  it("regular assignment <70 shows $0, not a penalty", () => {
    expect(getRewardStatus(make({ grade: 69 }))).toMatchObject({ earned: 0, label: "$0.00" });
  });

  it.each(["test", "quiz"] as const)("%s >=70 shows +$20", type => {
    expect(getRewardStatus(make({ type, grade: 70 }))).toMatchObject({ earned: 20, label: "+$20.00" });
  });

  it.each(["test", "quiz"] as const)("%s <70 shows -$20, flagged as makeup-available while the window is open", type => {
    expect(getRewardStatus(make({ type, grade: 50, daysLeft: 3 }))).toMatchObject({ earned: -20, label: "-$20.00 (Makeup Available)" });
    expect(getRewardStatus(make({ type, grade: 50, daysLeft: 0 }))).toMatchObject({ earned: -20, label: "-$20.00" });
    expect(getRewardStatus(make({ type, grade: 50, daysLeft: null }))).toMatchObject({ earned: -20, label: "-$20.00" });
  });

  it("missing earns $0 for every type (no penalty)", () => {
    for (const type of ["assignment", "quiz", "test"] as const) {
      expect(getRewardStatus(make({ type, status: "missing", grade: null })).earned).toBe(0);
    }
  });

  it("pending has no earned value yet", () => {
    expect(getRewardStatus(make({ status: "pending", grade: null })).earned).toBeNull();
  });
});

describe("getRewardStatus follows the family's saved rules", () => {
  const RULES: RewardRules = { assignmentReward: 5, testReward: 35, passingThreshold: 80 };

  it("labels and amounts use the configured rewards", () => {
    expect(getRewardStatus(make({ grade: 85 }), RULES)).toMatchObject({ earned: 5, label: "+$5.00" });
    expect(getRewardStatus(make({ type: "test", grade: 85 }), RULES)).toMatchObject({ earned: 35, label: "+$35.00" });
    expect(getRewardStatus(make({ type: "quiz", grade: 40 }), RULES)).toMatchObject({ earned: -35, label: "-$35.00" });
    expect(getRewardStatus(make({ type: "quiz", grade: 40, daysLeft: 2 }), RULES).label).toBe("-$35.00 (Makeup Available)");
  });

  it("the pass mark moves with the settings, on both sides of it", () => {
    expect(getRewardStatus(make({ grade: 79 }), RULES).earned).toBe(0);
    expect(getRewardStatus(make({ grade: 80 }), RULES).earned).toBe(5);
    expect(getRewardStatus(make({ type: "test", grade: 79 }), RULES).earned).toBe(-35);
    expect(getRewardStatus(make({ type: "test", grade: 80 }), RULES).earned).toBe(35);
  });

  it("a grade that passes under the defaults can fail under a stricter pass mark", () => {
    const a = make({ type: "test", grade: 75 });
    expect(getRewardStatus(a).earned).toBe(20);
    expect(getRewardStatus(a, RULES).earned).toBe(-35);
  });

  it("fractional amounts keep cents", () => {
    expect(getRewardStatus(make({ grade: 90 }), { ...HOUSE_RULES, assignmentReward: 2.5 }).label).toBe("+$2.50");
  });

  it("with no rules given it uses the house defaults", () => {
    expect(getRewardStatus(make({ grade: 90 }))).toEqual(getRewardStatus(make({ grade: 90 }), HOUSE_RULES));
  });
});

describe("rewardAmountFor / formatMoney", () => {
  const RULES: RewardRules = { assignmentReward: 4, testReward: 25, passingThreshold: 70 };

  it("assignments pay the assignment amount; tests and quizzes share the test amount", () => {
    expect(rewardAmountFor("assignment", RULES)).toBe(4);
    expect(rewardAmountFor("quiz", RULES)).toBe(25);
    expect(rewardAmountFor("test", RULES)).toBe(25);
  });

  it("whole amounts have no decimals; others keep two", () => {
    expect(formatMoney(3)).toBe("$3");
    expect(formatMoney(20)).toBe("$20");
    expect(formatMoney(2.5)).toBe("$2.50");
    expect(formatMoney(0)).toBe("$0");
  });

  it("HOUSE_RULES are exactly the agreed $3 / $20 / 70%", () => {
    expect(HOUSE_RULES).toEqual({ assignmentReward: 3, testReward: 20, passingThreshold: 70 });
    expect(DEFAULT_REWARD_SETTINGS).toMatchObject(HOUSE_RULES);
  });
});

describe("graded cards show what the ledger recorded (not a recomputation)", () => {
  const RULES: RewardRules = { assignmentReward: 3, testReward: 20, passingThreshold: 70 };

  it("uses the recorded amount even when today's rate differs", () => {
    // Graded back when assignments paid $5; the family has since lowered it to $3.
    expect(getRewardStatus(make({ grade: 85, recordedReward: 5 }), RULES)).toMatchObject({ earned: 5, label: "+$5.00" });
  });

  it("a recorded penalty keeps its amount, and the makeup hint while the window is open", () => {
    expect(getRewardStatus(make({ type: "test", grade: 50, recordedReward: -35, daysLeft: 2 }), RULES)).toMatchObject({ earned: -35, label: "-$35.00 (Makeup Available)" });
    expect(getRewardStatus(make({ type: "test", grade: 50, recordedReward: -35, daysLeft: 0 }), RULES)).toMatchObject({ earned: -35, label: "-$35.00" });
  });

  it("graded with nothing recorded (null) is $0, not a recomputed reward", () => {
    expect(getRewardStatus(make({ grade: 40, recordedReward: null }), RULES)).toMatchObject({ earned: 0, label: "$0.00" });
    // ...even for a grade that would pay under today's rules:
    expect(getRewardStatus(make({ grade: 95, recordedReward: null }), RULES).earned).toBe(0);
  });

  it("pending and missing ignore any recorded value", () => {
    expect(getRewardStatus(make({ status: "pending", grade: null, recordedReward: 5 }), RULES).earned).toBeNull();
    expect(getRewardStatus(make({ status: "missing", grade: null, recordedReward: 5 }), RULES).earned).toBe(0);
  });

  it("when recordedReward is absent the rules still apply (previews)", () => {
    expect(getRewardStatus(make({ grade: 85 }), RULES).earned).toBe(3);
  });
});
