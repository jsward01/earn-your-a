import { describe, expect, it } from "vitest";
import { classKeyOf, planClassChange, type ClassWork } from "./classSettings";
import { computeAssignmentReward, type FullRewardSettings } from "./rewards";
import { ARCHIVE_ON_PAYOUT_WHERE } from "./assignments";

const SETTINGS: FullRewardSettings = {
  assignmentReward: 5, quizReward: 10, testReward: 20, assignmentPenalty: 0, quizPenalty: 10, testPenalty: 20,
  penalizeMissing: false, passingThreshold: 70, makeupWindowDays: 7, holdback: 20, holdbackType: "amount",
  rewardType: "money", payoutSchedule: "manual",
};

const w = (over: Partial<ClassWork>): ClassWork => ({
  id: "a", subject: "Spanish II", title: "Vocab", type: "assignment", status: "graded", grade: 90,
  historyOnly: false, trackOnly: false, recorded: 5, ...over,
});

describe("Track only pricing", () => {
  it("Track only work never has a ledger entry, passing, failing or missing", () => {
    for (const status of ["graded", "missing", "pending"] as const) {
      for (const grade of [100, 40]) {
        expect(computeAssignmentReward({ type: "test", status, grade, title: "T", trackOnly: true }, { ...SETTINGS, penalizeMissing: true })).toBeNull();
      }
    }
  });

  it("payouts never archive Track only work", () => {
    expect(ARCHIVE_ON_PAYOUT_WHERE).toContain("track_only = 0");
  });
});

describe("planClassChange", () => {
  it("Track only: every item in the class whose flag differs goes to $0", () => {
    const changes = planClassChange([
      w({ id: "1" }),
      w({ id: "2", subject: "Spanish II", type: "test", grade: 50, recorded: -20 }),
      w({ id: "3", subject: "Geometry" }),
      w({ id: "4", trackOnly: true, recorded: null }),
      w({ id: "5", status: "pending", grade: null, recorded: null }),
    ], classKeyOf("Spanish II -S1"), true, SETTINGS);
    expect(changes).toEqual([
      { id: "1", title: "Vocab", before: 5, after: 0 },
      { id: "2", title: "Vocab", before: -20, after: 0 },
      { id: "5", title: "Vocab", before: 0, after: 0 },
    ]);
  });

  it("Pays: Track only work is priced at today's rates", () => {
    const changes = planClassChange([
      w({ id: "1", trackOnly: true, recorded: null }),
      w({ id: "2", trackOnly: true, recorded: null, type: "quiz", grade: 60 }),
      w({ id: "3", trackOnly: true, recorded: null, historyOnly: true }),
      w({ id: "4" }),
    ], "spanish ii", false, SETTINGS);
    expect(changes.map(c => [c.id, c.before, c.after])).toEqual([["1", 0, 5], ["2", 0, -10], ["3", 0, 0]]);
  });
});
