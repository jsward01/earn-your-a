import { describe, expect, it } from "vitest";
import type { Assignment } from "../types";
import { splitPending } from "./assignments";

const NOW = new Date(2026, 8, 21, 20, 0, 0); // Mon Sep 21 2026, 8pm local

function a(id: string, dueDate: string, status: Assignment["status"] = "pending"): Assignment {
  return { id, title: id, subject: "Biology", type: "assignment", dueDate, status, grade: null, daysLeft: null, makeupAvailable: false, recordedReward: null, payoutId: null, paidAt: null };
}

describe("splitPending", () => {
  it("puts past-due ungraded work in needsGrade, oldest first", () => {
    const { needsGrade } = splitPending([a("b", "2026-09-19"), a("a", "2026-09-10"), a("c", "2026-09-20")], NOW);
    expect(needsGrade.map(x => x.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps work due today or later in comingUp, soonest first (even at 8pm)", () => {
    const { needsGrade, comingUp } = splitPending([a("later", "2026-10-02"), a("today", "2026-09-21"), a("soon", "2026-09-23")], NOW);
    expect(needsGrade).toEqual([]);
    expect(comingUp.map(x => x.id)).toEqual(["today", "soon", "later"]);
  });

  it("ignores graded and missing work", () => {
    const { needsGrade, comingUp } = splitPending([a("g", "2026-09-01", "graded"), a("m", "2026-09-01", "missing")], NOW);
    expect(needsGrade).toEqual([]);
    expect(comingUp).toEqual([]);
  });
});
