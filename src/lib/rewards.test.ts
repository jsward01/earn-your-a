import { describe, expect, it } from "vitest";
import type { Assignment } from "../types";
import { getRewardStatus } from "./rewards";

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
