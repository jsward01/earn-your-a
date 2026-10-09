import { describe, expect, it } from "vitest";
import type { Assignment } from "../types";
import { groupDueWork, splitPending } from "./assignments";

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

describe("groupDueWork", () => {
  const g = (id: string, dueDate: string, extra: Partial<Assignment> = {}): Assignment => ({ ...a(id, dueDate), ...extra });

  it("buckets pending work by how far off its due date is (local days, even at 8pm)", () => {
    const groups = groupDueWork([
      g("later", "2026-09-28"),
      g("week-end", "2026-09-27"),
      g("week", "2026-09-23"),
      g("tomorrow", "2026-09-22"),
      g("today", "2026-09-21"),
      g("past", "2026-09-18"),
    ], 70, NOW);
    expect(groups.waiting.map(x => x.id)).toEqual(["past"]);
    expect(groups.today.map(x => x.id)).toEqual(["today"]);
    expect(groups.tomorrow.map(x => x.id)).toEqual(["tomorrow"]);
    expect(groups.thisWeek.map(x => x.id)).toEqual(["week", "week-end"]);
    expect(groups.later.map(x => x.id)).toEqual(["later"]);
  });

  it("lists missing and below-passing work with an open makeup window, soonest deadline first", () => {
    const groups = groupDueWork([
      g("low", "2026-09-15", { status: "graded", grade: 60, makeupAvailable: true, daysLeft: 5 }),
      g("missing", "2026-09-16", { status: "missing", makeupAvailable: true, daysLeft: 2 }),
      g("passed", "2026-09-15", { status: "graded", grade: 85 }),
      g("closed", "2026-09-01", { status: "missing", makeupAvailable: true, daysLeft: 0 }),
      g("used", "2026-09-10", { status: "graded", grade: 50, makeupAvailable: false, daysLeft: 3 }),
    ], 70, NOW);
    expect(groups.fixIt.map(x => x.id)).toEqual(["missing", "low"]);
  });

  it("leaves out history work and work a payout already settled", () => {
    const groups = groupDueWork([
      g("history", "2026-09-22", { historyOnly: true }),
      g("paid", "2026-09-10", { status: "missing", makeupAvailable: true, daysLeft: 3, payoutId: "p1" }),
    ], 70, NOW);
    expect(Object.values(groups).flat()).toEqual([]);
  });
});
