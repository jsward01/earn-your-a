import { describe, expect, it } from "vitest";
import type { Assignment } from "../types";
import { progressClasses, rangeStart, weekStart, weeklyEarnings, weeklyGrades } from "./progress";

const a = (over: Partial<Assignment>): Assignment => ({
  id: Math.random().toString(36), title: "T", subject: "Biology", type: "assignment", dueDate: "2026-10-14", status: "graded", grade: 90,
  daysLeft: null, recordedReward: 5, ...over,
});

describe("weekStart", () => {
  it("is the Sunday of the week (Sun–Sat)", () => {
    expect(weekStart("2026-10-11")).toBe("2026-10-11"); // Sunday
    expect(weekStart("2026-10-17")).toBe("2026-10-11"); // Saturday
    expect(weekStart("2026-10-18")).toBe("2026-10-18");
    expect(weekStart("2026-11-01")).toBe("2026-11-01"); // across the DST change
    expect(weekStart("2027-01-01")).toBe("2026-12-27"); // across the year
  });
});

describe("rangeStart", () => {
  it("school year starts July 1; recent = the Sunday 8 weeks back", () => {
    expect(rangeStart("year", new Date(2026, 9, 20))).toBe("2026-07-01");
    expect(rangeStart("year", new Date(2027, 1, 3))).toBe("2026-07-01");
    expect(rangeStart("recent", new Date(2026, 9, 20))).toBe("2026-08-30");
  });
});

describe("weeklyGrades", () => {
  const work = [
    a({ dueDate: "2026-10-12", grade: 100 }),
    a({ dueDate: "2026-10-13", status: "missing", grade: null }),
    a({ dueDate: "2026-10-14", subject: "Spanish II", grade: 80, trackOnly: true, recordedReward: null }),
    a({ dueDate: "2026-10-05", grade: 70, historyOnly: true }),
    a({ dueDate: "2026-10-15", status: "pending", grade: null }),
    a({ dueDate: "2026-10-30", grade: 10 }), // after "today"
  ];
  it("averages each week, missing = 0, incl. Track only and history; skips pending and future", () => {
    expect(weeklyGrades(work, "2026-07-01", null, "2026-10-20")).toEqual([
      { week: "2026-10-04", value: 70, count: 1 },
      { week: "2026-10-11", value: 60, count: 3 },
    ]);
  });
  it("one class, matched by class key", () => {
    expect(weeklyGrades([...work, a({ subject: "spanish ii -S1", dueDate: "2026-10-16", grade: 60 })], "2026-07-01", "spanish ii", "2026-10-20"))
      .toEqual([{ week: "2026-10-11", value: 70, count: 2 }]);
  });
  it("respects the range start", () => {
    expect(weeklyGrades(work, "2026-10-11", null, "2026-10-20").map(p => p.week)).toEqual(["2026-10-11"]);
  });
});

describe("weeklyEarnings", () => {
  it("nets each week by due date and fills quiet weeks through this week with $0", () => {
    const weeks = weeklyEarnings([
      a({ dueDate: "2026-09-29", recordedReward: 5 }),
      a({ dueDate: "2026-09-30", type: "test", grade: 50, recordedReward: -20 }),
      a({ dueDate: "2026-10-14", recordedReward: 5 }),
      a({ dueDate: "2026-10-14", trackOnly: true, recordedReward: null }),
    ], "2026-07-01", "2026-10-20");
    expect(weeks.map(w => [w.week, w.value, w.earned, w.lost, w.count])).toEqual([
      ["2026-09-27", -15, 5, 20, 2],
      ["2026-10-04", 0, 0, 0, 0],
      ["2026-10-11", 5, 5, 0, 1],
      ["2026-10-18", 0, 0, 0, 0],
    ]);
  });
  it("nothing recorded = no weeks", () => {
    expect(weeklyEarnings([a({ recordedReward: null })], "2026-07-01", "2026-10-20")).toEqual([]);
  });
});

describe("progressClasses", () => {
  it("merges spellings of the same class and sorts by name", () => {
    expect(progressClasses([a({ subject: "Spanish II" }), a({ subject: "spanish ii" }), a({ subject: "Biology" })]))
      .toEqual([{ key: "biology", name: "Biology" }, { key: "spanish ii", name: "Spanish II" }]);
  });
});
