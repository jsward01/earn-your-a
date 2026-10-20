import { describe, expect, it } from "vitest";
import { parseFromDate, planReprice, summarizeReprice, type RepriceAssignment } from "./reprice";
import type { FullRewardSettings } from "./rewards";

const RATES: FullRewardSettings = {
  assignmentReward: 5,
  quizReward: 10,
  testReward: 20,
  assignmentPenalty: 0,
  quizPenalty: 10,
  testPenalty: 20,
  penalizeMissing: false,
  passingThreshold: 70,
  makeupWindowDays: 7,
  holdback: 20,
  holdbackType: "amount",
  rewardType: "money",
  payoutSchedule: "request",
};

let n = 0;
function item(over: Partial<RepriceAssignment>): RepriceAssignment {
  n += 1;
  return {
    id: `a${n}`, studentId: "s1", title: `Item ${n}`, type: "assignment", status: "graded", grade: 90,
    historyOnly: false, paid: false, recorded: 3, ...over,
  };
}

describe("planReprice", () => {
  it("re-prices passing work recorded at an old rate", () => {
    const changes = planReprice([item({ id: "x", recorded: 3 })], RATES);
    expect(changes).toEqual([{ assignmentId: "x", studentId: "s1", title: expect.any(String), type: "assignment", paid: false, before: 3, after: 5 }]);
  });

  it("leaves work already at today's rate alone (so running it twice does nothing)", () => {
    expect(planReprice([item({ recorded: 5 })], RATES)).toEqual([]);
  });

  it("counts a paid item's catch-up rows: $3 paid + $2 catch-up = $5 is up to date", () => {
    expect(planReprice([item({ paid: true, recorded: 3 + 2 })], RATES)).toEqual([]);
  });

  it("re-prices paid work too, flagged as paid", () => {
    const [c] = planReprice([item({ paid: true, recorded: 3 })], RATES);
    expect(c).toMatchObject({ paid: true, before: 3, after: 5 });
  });

  it("handles a rate cut (old ±$20 quiz at today's ±$10), both ways", () => {
    const changes = planReprice([
      item({ type: "quiz", grade: 95, recorded: 20 }),
      item({ type: "quiz", grade: 40, recorded: -20 }),
    ], RATES);
    expect(changes.map(c => [c.before, c.after])).toEqual([[20, 10], [-20, -10]]);
  });

  it("charges already-missing work when penalizeMissing is on, and refunds it when off", () => {
    const missing = item({ type: "test", status: "missing", grade: null, recorded: null });
    expect(planReprice([missing], { ...RATES, penalizeMissing: true })[0]).toMatchObject({ before: 0, after: -20 });
    expect(planReprice([{ ...missing, recorded: -20 }], RATES)[0]).toMatchObject({ before: -20, after: 0 });
  });

  it("follows a new passing grade", () => {
    expect(planReprice([item({ grade: 72, recorded: 3 })], { ...RATES, passingThreshold: 75 })[0]).toMatchObject({ before: 3, after: 0 });
  });

  it("never prices history or ungraded work", () => {
    expect(planReprice([
      item({ historyOnly: true, recorded: null }),
      item({ status: "pending", grade: null, recorded: null }),
    ], RATES)).toEqual([]);
  });
});

describe("summarizeReprice", () => {
  it("totals per student, split into unpaid and paid, with one line per kind of change", () => {
    const changes = planReprice([
      ...Array.from({ length: 43 }, () => item({ paid: true, recorded: 3 })),
      item({ recorded: 3 }),
      item({ type: "quiz", grade: 95, recorded: 20 }),
      item({ studentId: "s2", recorded: 3 }),
    ], RATES);
    const [s1, s2] = summarizeReprice(changes);
    expect(s1).toMatchObject({ studentId: "s1", paid: { count: 43, delta: 86 }, unpaid: { count: 2, delta: -8 }, delta: 78 });
    expect(s1.groups).toEqual([
      { type: "assignment", before: 3, after: 5, count: 44, delta: 88 },
      { type: "quiz", before: 20, after: 10, count: 1, delta: -10 },
    ]);
    expect(s2).toMatchObject({ studentId: "s2", delta: 2 });
  });
});

describe("parseFromDate", () => {
  it.each([undefined, null, ""])("%s means all work", v => expect(parseFromDate(v)).toEqual({ from: null }));
  it("accepts a real day", () => expect(parseFromDate("2026-10-12")).toEqual({ from: "2026-10-12" }));
  it.each(["2026-02-30", "2026-13-01", "10/12/2026", "2026-10-12T00:00", 20261012])("rejects %s", v => {
    expect(parseFromDate(v)).toHaveProperty("error");
  });
});
