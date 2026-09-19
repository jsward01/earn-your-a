import { describe, expect, it } from "vitest";
import type { Assignment } from "../types";
import { DEFAULT_REWARD_SETTINGS, formatAmount, getRewardStatus, HOUSE_RULES, rewardAmountFor, unitWord, type RewardFormat, type RewardRules } from "./rewards";

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
  const RULES: RewardRules = { ...HOUSE_RULES, assignmentReward: 5, testReward: 35, passingThreshold: 80 };

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

describe("rewardAmountFor", () => {
  const RULES: RewardRules = { ...HOUSE_RULES, assignmentReward: 4, testReward: 25, passingThreshold: 70 };

  it("assignments pay the assignment amount; tests and quizzes share the test amount", () => {
    expect(rewardAmountFor("assignment", RULES)).toBe(4);
    expect(rewardAmountFor("quiz", RULES)).toBe(25);
    expect(rewardAmountFor("test", RULES)).toBe(25);
  });

  it("HOUSE_RULES are exactly the agreed $3 / $20 / 70%", () => {
    expect(HOUSE_RULES).toEqual({ assignmentReward: 3, testReward: 20, passingThreshold: 70, rewardType: "money", customUnit: "" });
    expect(DEFAULT_REWARD_SETTINGS).toMatchObject(HOUSE_RULES);
  });
});

describe("graded cards show what the ledger recorded (not a recomputation)", () => {
  const RULES: RewardRules = { ...HOUSE_RULES, assignmentReward: 3, testReward: 20, passingThreshold: 70 };

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

const MONEY: RewardFormat = { rewardType: "money", customUnit: "" };
const POINTS: RewardFormat = { rewardType: "points", customUnit: "" };
const SCREEN: RewardFormat = { rewardType: "screen", customUnit: "" };
const STARS: RewardFormat = { rewardType: "custom", customUnit: "stars" };

describe("formatAmount — the unit follows the reward type", () => {
  it("money: $ prefix, cents by default", () => {
    expect(formatAmount(5, MONEY)).toBe("$5.00");
    expect(formatAmount(2.5, MONEY)).toBe("$2.50");
    expect(formatAmount(0, MONEY)).toBe("$0.00");
    expect(formatAmount(-20, MONEY)).toBe("-$20.00");
  });

  it("money, short: whole amounts drop the decimals, others keep them", () => {
    expect(formatAmount(3, MONEY, { short: true })).toBe("$3");
    expect(formatAmount(2.5, MONEY, { short: true })).toBe("$2.50");
    expect(formatAmount(0, MONEY, { short: true })).toBe("$0");
  });

  it("signed: + for gains, - for losses, nothing for zero", () => {
    expect(formatAmount(5, MONEY, { signed: true })).toBe("+$5.00");
    expect(formatAmount(-5, MONEY, { signed: true })).toBe("-$5.00");
    expect(formatAmount(0, MONEY, { signed: true })).toBe("$0.00");
    expect(formatAmount(5, POINTS, { signed: true })).toBe("+5 pts");
  });

  it("points: 'pt' for exactly one, otherwise 'pts'", () => {
    expect(formatAmount(5, POINTS)).toBe("5 pts");
    expect(formatAmount(1, POINTS)).toBe("1 pt");
    expect(formatAmount(-1, POINTS)).toBe("-1 pt");
    expect(formatAmount(0, POINTS)).toBe("0 pts");
  });

  it("screen time is in minutes", () => {
    expect(formatAmount(30, SCREEN)).toBe("30 min");
    expect(formatAmount(-20, SCREEN, { signed: true })).toBe("-20 min");
  });

  it("custom uses the family's word, and falls back to 'units' when blank", () => {
    expect(formatAmount(3, STARS)).toBe("3 stars");
    expect(formatAmount(3, { rewardType: "custom", customUnit: "" })).toBe("3 units");
    expect(formatAmount(3, { rewardType: "custom", customUnit: "   " })).toBe("3 units");
    expect(formatAmount(3, { rewardType: "custom", customUnit: "  stars " })).toBe("3 stars");
  });

  it("non-money amounts trim trailing zeros but keep real fractions", () => {
    expect(formatAmount(2.5, POINTS)).toBe("2.5 pts");
    expect(formatAmount(2.25, POINTS)).toBe("2.25 pts");
    expect(formatAmount(4, SCREEN, { short: true })).toBe("4 min");
  });

  it("rounds to cents first so float noise never shows", () => {
    expect(formatAmount(0.1 + 0.2, MONEY)).toBe("$0.30");
    expect(formatAmount(0.1 + 0.2, POINTS)).toBe("0.3 pts");
    expect(formatAmount(-0.001, MONEY)).toBe("$0.00"); // rounds to zero: no "-$0.00"
  });

  it("the unit word alone", () => {
    expect(unitWord(MONEY)).toBe("");
    expect(unitWord(SCREEN)).toBe("min");
    expect(unitWord(POINTS, 1)).toBe("pt");
    expect(unitWord(POINTS, 2)).toBe("pts");
    expect(unitWord(STARS)).toBe("stars");
  });
});

describe("reward labels on cards use the reward type", () => {
  const rules = (fmt: RewardFormat): RewardRules => ({ ...HOUSE_RULES, ...fmt });

  it("points", () => {
    expect(getRewardStatus(make({ grade: 90 }), rules(POINTS)).label).toBe("+3 pts");
    expect(getRewardStatus(make({ type: "test", grade: 40, daysLeft: 3 }), rules(POINTS)).label).toBe("-20 pts (Makeup Available)");
    expect(getRewardStatus(make({ grade: 40 }), rules(POINTS)).label).toBe("0 pts");
  });

  it("screen time and custom", () => {
    expect(getRewardStatus(make({ type: "test", grade: 90 }), rules(SCREEN)).label).toBe("+20 min");
    expect(getRewardStatus(make({ type: "quiz", grade: 40 }), rules(STARS)).label).toBe("-20 stars");
  });

  it("recorded amounts are written in the current unit too", () => {
    expect(getRewardStatus(make({ grade: 85, recordedReward: 5 }), rules(POINTS)).label).toBe("+5 pts");
    expect(getRewardStatus(make({ grade: 85, recordedReward: null }), rules(SCREEN)).label).toBe("0 min");
  });

  it("the reward type never changes the numbers, only how they're written", () => {
    for (const fmt of [MONEY, POINTS, SCREEN, STARS]) {
      expect(getRewardStatus(make({ type: "test", grade: 90 }), rules(fmt)).earned).toBe(20);
      expect(getRewardStatus(make({ type: "test", grade: 40 }), rules(fmt)).earned).toBe(-20);
    }
  });
});
