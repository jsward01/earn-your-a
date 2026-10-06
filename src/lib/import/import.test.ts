import { describe, expect, it } from "vitest";
import type { Assignment } from "../../types";
import { findDate, parseInfiniteCampus, splitStamp, splitTitleAndClass } from "./infiniteCampus";
import { buildPlan, guessType } from "./match";

const CLASSES = ["Geometry", "Biology", "CE / Computer Tech I A", "World Geo & Civilizations", "Spanish II", "English 10"];

describe("parseInfiniteCampus", () => {
  it("reads scores, converts points to a rounded percent", () => {
    const { items } = parseInfiniteCampus("Susana received a score of 8 out of 14 on Concept Check 1.2 in Geometry", CLASSES);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ className: "Geometry", title: "Concept Check 1.2", status: "graded", grade: 57, points: { earned: 8, possible: 14 }, flags: [] });
  });

  it("reads missing flags", () => {
    const { items } = parseInfiniteCampus("Susana's assignment 2.1 Power Supplies in CE / Computer Tech I A has been flagged (Missing)", CLASSES);
    expect(items[0]).toMatchObject({ className: "CE / Computer Tech I A", title: "2.1 Power Supplies", status: "missing", grade: null });
  });

  it("keeps Late/Incomplete as flags and skips Dropped", () => {
    const { items, skipped } = parseInfiniteCampus(
      [
        "Susana received a score of 9 out of 10 on Catcher Webquest in English 10 and the assignment has been flagged (Late)",
        "Susana received a score of 0 out of 10 on Old Warmup in Spanish II and the assignment has been flagged (Dropped)",
        "Susana's assignment Bell Ringer in Biology has been flagged (Dropped)",
      ].join("\n"),
      CLASSES,
    );
    expect(items).toHaveLength(1);
    expect(items[0].flags).toEqual(["late"]);
    expect(skipped.map(s => s.reason)).toEqual([expect.stringMatching(/Dropped/), expect.stringMatching(/Dropped/)]);
  });

  it("ignores noise lines", () => {
    const text = [
      "Notifications",
      "Susana has an updated grade of B+ (88.5%) in Geometry Semester Grade",
      "Susana was marked Absent in Biology Period 3",
      "Mark all as read",
      "",
    ].join("\n");
    expect(parseInfiniteCampus(text, CLASSES)).toEqual({ items: [], skipped: [] });
  });

  it("handles extra whitespace, curly apostrophes and trailing periods", () => {
    const { items } = parseInfiniteCampus(
      "  Susana’s   assignment  MOVEMENT OF WATER LAB in Biology has been flagged (Missing).  \r\n",
      CLASSES,
    );
    expect(items[0]).toMatchObject({ title: "MOVEMENT OF WATER LAB", className: "Biology", status: "missing" });
  });

  it("skips out-of-0 scores instead of dividing by zero", () => {
    const { items, skipped } = parseInfiniteCampus("Susana received a score of 2 out of 0 on Bonus in Geometry", CLASSES);
    expect(items).toEqual([]);
    expect(skipped).toHaveLength(1);
  });

  it("allows extra credit above 100%", () => {
    const { items } = parseInfiniteCampus("Susana received a score of 11 out of 10 on Bonus Sheet in Geometry", CLASSES);
    expect(items[0].grade).toBe(110);
  });

  it("keeps the newest score for a re-scored item (list is newest first)", () => {
    const { items } = parseInfiniteCampus(
      [
        "Susana received a score of 4 out of 4 on 1.5 Reflection in CE / Computer Tech I A",
        "Susana received a score of 0 out of 4 on 1.5 Reflection in CE / Computer Tech I A",
      ].join("\n"),
      CLASSES,
    );
    expect(items).toHaveLength(1);
    expect(items[0].grade).toBe(100);
  });

  it("uses dates when present to pick the newest, regardless of order", () => {
    const { items } = parseInfiniteCampus(
      [
        "Susana received a score of 0 out of 4 on 1.5 Reflection in CE / Computer Tech I A",
        "9/19/2026 2:04 PM",
        "Susana received a score of 4 out of 4 on 1.5 Reflection in CE / Computer Tech I A",
        "9/23/2026 8:15 AM",
      ].join("\n"),
      CLASSES,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ grade: 100, date: "2026-09-23" });
  });

  it("attaches date-only lines to the notification above, and inline stamps to their own line", () => {
    const { items } = parseInfiniteCampus(
      [
        "Susana received a score of 9 out of 10 on Daniel el Detective in Spanish II",
        "Sep 4, 2026 3:15 PM",
        "09/05/2026 - Susana received a score of 2 out of 3 on Concept check 2.1 in Geometry",
        "Susana's assignment 2.2 Memory in CE / Computer Tech I A has been flagged (Missing) 9/19/26 4:00 PM",
        "Susana received a score of 1 out of 1 on No Date Here in Biology",
      ].join("\n"),
      CLASSES,
    );
    expect(items.map(i => [i.title, i.date])).toEqual([
      ["Daniel el Detective", "2026-09-04"],
      ["Concept check 2.1", "2026-09-05"],
      ["2.2 Memory", "2026-09-19"],
      ["No Date Here", null],
    ]);
  });

  it("works for any student name", () => {
    const { items } = parseInfiniteCampus("Alex Rivera received a score of 5 out of 5 on HW 3 in Geometry", CLASSES);
    expect(items[0].title).toBe("HW 3");
  });
});

describe("splitTitleAndClass", () => {
  it("prefers a known class when the title contains ' in '", () => {
    expect(splitTitleAndClass("Practice in Pairs in Geometry", CLASSES)).toEqual({ title: "Practice in Pairs", className: "Geometry" });
    expect(splitTitleAndClass("Living in the City in World Geo & Civilizations", CLASSES)).toEqual({ title: "Living in the City", className: "World Geo & Civilizations" });
  });

  it("matches known classes ignoring case, and returns the app's spelling", () => {
    expect(splitTitleAndClass("HW in geometry", CLASSES)).toEqual({ title: "HW", className: "Geometry" });
  });

  it("falls back to the last ' in ' for an unknown class", () => {
    expect(splitTitleAndClass("Essay in Drama I", CLASSES)).toEqual({ title: "Essay", className: "Drama I" });
    expect(splitTitleAndClass("No class here", CLASSES)).toBeNull();
  });
});

describe("dates", () => {
  it("finds the common formats", () => {
    expect(findDate("9/21/2026")).toBe("2026-09-21");
    expect(findDate("9/21/26 2:04 PM")).toBe("2026-09-21");
    expect(findDate("2026-09-21")).toBe("2026-09-21");
    expect(findDate("Monday, September 21, 2026")).toBe("2026-09-21");
    expect(findDate("WFR (Aug 24 - Sept 4)")).toBeNull();
  });

  it("does not treat a date-like title as a stamp", () => {
    expect(splitStamp("Susana received a score of 1 out of 1 on WFR (Aug 24 - Sept 4) in CE / Computer Tech I A").date).toBeNull();
  });
});

describe("guessType", () => {
  it.each([
    ["Test #1 (5 Themes)", "test"],
    ["1.1 TEST", "test"],
    ["Module 1-2 test", "test"],
    ["Module 1 Quiz", "quiz"],
    ["SA:V QUIZ", "quiz"],
    ["Population Map Quiz", "quiz"],
    ["Study Guide for Test #1", "assignment"],
    ["World Map Locations (Part of Test #1)", "test"],
    ["Quizlet Learn - Most Common Verbs Meanings", "assignment"],
    ["Concept Check 1.2", "assignment"],
    ["U1 REVIEW SHEET", "assignment"],
  ])("%s → %s", (title, type) => {
    expect(guessType(title)).toBe(type);
  });
});

function a(over: Partial<Assignment>): Assignment {
  return { id: "x", title: "T", subject: "Geometry", type: "assignment", dueDate: "2026-09-01", status: "pending", grade: null, daysLeft: null, payoutId: null, ...over };
}

describe("buildPlan", () => {
  const parse = (t: string) => parseInfiniteCampus(t, CLASSES).items;

  it("new work is ticked, with a guessed type", () => {
    const [row] = buildPlan(parse("Susana received a score of 13 out of 20 on Unit 2 Test in Geometry"), []);
    expect(row).toMatchObject({ kind: "new", type: "test", selected: true });
  });

  it("matches ignoring case and punctuation, and grades pending work", () => {
    const existing = a({ id: "1", title: "Concept check 2.1", status: "pending" });
    const [row] = buildPlan(parse("Susana received a score of 2 out of 3 on Concept Check 2.1 in geometry"), [existing]);
    expect(row).toMatchObject({ kind: "update", existing, selected: true, note: "pending → 67%" });
  });

  it("same grade is unchanged and unticked", () => {
    const [row] = buildPlan(parse("Susana received a score of 2 out of 3 on HW in Geometry"), [a({ title: "HW", status: "graded", grade: 67 })]);
    expect(row).toMatchObject({ kind: "unchanged", selected: false });
  });

  it("a re-score updates and keeps the existing type", () => {
    const [row] = buildPlan(parse("Susana received a score of 4 out of 4 on Quiz Redo in Geometry"), [a({ title: "Quiz Redo", type: "assignment", status: "graded", grade: 0 })]);
    expect(row).toMatchObject({ kind: "update", type: "assignment", selected: true, note: "0% → 100%" });
  });

  it("paid-out work is locked, never ticked", () => {
    const [row] = buildPlan(parse("Susana received a score of 9 out of 10 on HW in Geometry"), [a({ title: "HW", status: "graded", grade: 50, payoutId: "p1" })]);
    expect(row).toMatchObject({ kind: "locked", selected: false });
    expect(row.note).toMatch(/Adjust/);
  });

  it("paid-out work that already matches is just unchanged", () => {
    const [row] = buildPlan(parse("Susana received a score of 5 out of 10 on HW in Geometry"), [a({ title: "HW", status: "graded", grade: 50, payoutId: "p1" })]);
    expect(row.kind).toBe("unchanged");
  });

  it("missing over an existing grade is offered but not ticked", () => {
    const [row] = buildPlan(parse("Susana's assignment HW in Geometry has been flagged (Missing)"), [a({ title: "HW", status: "graded", grade: 90 })]);
    expect(row).toMatchObject({ kind: "update", selected: false });
  });

  it("missing over pending work is ticked", () => {
    const [row] = buildPlan(parse("Susana's assignment HW in Geometry has been flagged (Missing)"), [a({ title: "HW" })]);
    expect(row).toMatchObject({ kind: "update", selected: true, note: "pending → missing" });
  });

  it("does not match the same title in a different class", () => {
    const [row] = buildPlan(parse("Susana received a score of 1 out of 1 on HW in Biology"), [a({ title: "HW", subject: "Geometry" })]);
    expect(row.kind).toBe("new");
  });
});

describe("real Campus screenshot (Oct 5, 2026)", () => {
  // As the screenshot reader returns it: one notification per line, " | " then the stamp shown under it.
  const NOW = new Date(2026, 9, 5, 13, 0); // Mon Oct 5 2026, 1pm local
  const LIVE = ["Biology", "CE / Computer Tech I A+", "English 10", "Geometry", "Spanish II", "World Geo & Civilizations"];
  const text = [
    "Susana was marked Present in CE / Computer Tech I A+ on 10/05/2026 | Today, 12:42 PM",
    "Susana received a score of 20 out of 20 on DNA & CELL CYCLE HW in Biology -S1 | Today, 11:01 AM",
    "Susana has an updated grade of A (91.52%) in Biology -S1: Semester Grade | Today, 11:01 AM",
    "Susana received a score of 10 out of 10 on Population Handout #6 in World Geo & Civilizations -S1 | Today, 9:54 AM",
    "Susana has an updated grade of B (85.96%) in World Geo & Civilizations -S1: Semester Grade | Today, 9:54 AM",
  ].join("\n");

  it("reads the two scores, ignores attendance and semester grades", () => {
    const { items, skipped } = parseInfiniteCampus(text, LIVE, NOW);
    expect(skipped).toEqual([]);
    expect(items.map(i => [i.title, i.className, i.grade, i.date])).toEqual([
      ["DNA & CELL CYCLE HW", "Biology", 100, "2026-10-05"],
      ["Population Handout #6", "World Geo & Civilizations", 100, "2026-10-05"],
    ]);
  });

  it("matches existing work despite the -S1 suffix", () => {
    const existing = a({ id: "1", title: "DNA & Cell Cycle HW", subject: "Biology" });
    const rows = buildPlan(parseInfiniteCampus(text, LIVE, NOW).items, [existing]);
    expect(rows[0]).toMatchObject({ kind: "update", existing });
    expect(rows[1].kind).toBe("new");
  });

  it("strips the term suffix even for a class the app hasn't seen", () => {
    expect(parseInfiniteCampus("Susana received a score of 1 out of 2 on Sketch in Art I - S2", [], NOW).items[0].className).toBe("Art I");
  });

  it("stamps on their own line (as wrapped in the panel)", () => {
    const { items } = parseInfiniteCampus(
      "Susana received a score of 20 out of 20 on DNA & CELL CYCLE HW in Biology -S1\nToday, 11:01 AM\n" +
        "Susana received a score of 3 out of 4 on Old HW in Biology -S1\nYesterday, 4:00 PM",
      LIVE, NOW,
    );
    expect(items.map(i => i.date)).toEqual(["2026-10-05", "2026-10-04"]);
  });
});

describe("relative and yearless dates", () => {
  const NOW = new Date(2026, 9, 5, 13, 0); // Monday
  it.each([
    ["Today, 12:42 PM", "2026-10-05"],
    ["Yesterday, 9:00 AM", "2026-10-04"],
    ["Friday, 3:15 PM", "2026-10-02"],
    ["Mon 8:00 AM", "2026-10-05"],
    ["10/02, 3:15 PM", "2026-10-02"],
    ["Oct 2, 3:15 PM", "2026-10-02"],
    ["Dec 20", "2025-12-20"], // in the future this year → last year
    ["9/30/2026 9:00 AM", "2026-09-30"],
  ])("%s → %s", (stamp, date) => {
    expect(findDate(stamp, NOW)).toBe(date);
  });
});
