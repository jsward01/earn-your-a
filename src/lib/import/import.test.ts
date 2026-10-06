import { describe, expect, it } from "vitest";
import type { Assignment } from "../../types";
import { findDate, parseInfiniteCampus, splitStamp, splitTitleAndClass } from "./infiniteCampus";
import { buildPlan, estimateDelta, guessType, notInList } from "./match";
import { DEFAULT_REWARD_SETTINGS } from "../rewards";

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
    expect(parseInfiniteCampus(text, CLASSES)).toEqual({ items: [], skipped: [], complete: false });
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

describe("Campus Assignments list (copied from the page)", () => {
  // Same layout as a real copy of Grades → Assignments; titles and scores made up.
  const LIST = [
    "Friday 08/14/2026",
    "Assignment", "Warm-Up 8/14 Vocab", "Spanish II -S1", "Score", "1/1(100%)",
    "Thursday 08/20/2026",
    "Assignment", "Lab Safety Contract", "Biology -S1", "Score", "10/10(100%)",
    "Assignment", "Penny Lab", "Biology -S1", "Dropped", "Score", "18/20(90%)",
    "Assignment", "Concept Check 1.2", "Geometry -S1", "Score", "4/7(57.14%)",
    "Wednesday 08/26/2026",
    "Assignment", "Module 1 Quiz", "Geometry -S1", "Score", "21/33(63.63%)",
    "Assignment", "Map Poster", "World Geo & Civilizations -S1", "CommentsDone in class", "Score", "10/10(100%)",
    "Thursday 09/03/2026",
    "Assignment", "Reading Answers", "Spanish II -S1", "CommentsCompleted 9/16", "Late", "Score", "3/3(100%)",
    "Thursday 09/24/2026",
    "Assignment", "Writing Quiz - Weekends", "Spanish II -S1", "Score", "13.5/15(90%)",
    "Monday 09/28/2026",
    "Assignment", "Quizlet Learn - Pastimes", "Spanish II -S1", "Missing", "Score", "0/1(0%)",
    "Friday 10/02/2026",
    "Assignment", "Jobs", "CE / Computer Tech I A+",
    "Monday 10/05/2026", "Today",
    "Assignment", "Cell Cycle HW", "Biology -S1", "Score", "20/20(100%)",
    "Tuesday 10/06/2026",
    "Assignment", "Listening Quiz - Weather", "Spanish II -S1",
  ].join("\n");
  const LIVE = ["Biology", "CE / Computer Tech I A+", "English 10", "Geometry", "Spanish II", "World Geo & Civilizations"];

  it("is detected and parsed instead of the notification format", () => {
    const { items, skipped } = parseInfiniteCampus(LIST, LIVE);
    expect(items.map(i => [i.title, i.className, i.status, i.grade, i.date])).toEqual([
      ["Warm-Up 8/14 Vocab", "Spanish II", "graded", 100, "2026-08-14"],
      ["Lab Safety Contract", "Biology", "graded", 100, "2026-08-20"],
      ["Concept Check 1.2", "Geometry", "graded", 57, "2026-08-20"],
      ["Module 1 Quiz", "Geometry", "graded", 64, "2026-08-26"],
      ["Map Poster", "World Geo & Civilizations", "graded", 100, "2026-08-26"],
      ["Reading Answers", "Spanish II", "graded", 100, "2026-09-03"],
      ["Writing Quiz - Weekends", "Spanish II", "graded", 90, "2026-09-24"],
      ["Quizlet Learn - Pastimes", "Spanish II", "missing", null, "2026-09-28"],
      ["Jobs", "CE / Computer Tech I A+", "pending", null, "2026-10-02"],
      ["Cell Cycle HW", "Biology", "graded", 100, "2026-10-05"],
      ["Listening Quiz - Weather", "Spanish II", "pending", null, "2026-10-06"],
    ]);
    expect(items.every(i => i.dueDateExact)).toBe(true);
    expect(skipped).toEqual([expect.objectContaining({ reason: expect.stringMatching(/Dropped/) })]);
  });

  it("keeps Late as a tag, ignores comments, uses the real class spelling", () => {
    const item = parseInfiniteCampus(LIST, LIVE).items.find(i => i.title === "Reading Answers")!;
    expect(item.flags).toEqual(["late"]);
    expect(parseInfiniteCampus(LIST, LIVE).items.find(i => i.title === "Jobs")!.className).toBe("CE / Computer Tech I A+");
  });

  it("strips the term suffix for a class the app hasn't seen", () => {
    const { items } = parseInfiniteCampus("Monday 10/05/2026\nAssignment\nSketch\nArt I -S1\nScore\n5/5(100%)", []);
    expect(items[0].className).toBe("Art I");
  });

  it("skips letter-grade and out-of-0 scores with a reason", () => {
    const { items, skipped } = parseInfiniteCampus(
      "Monday 10/05/2026\nAssignment\nBonus\nGeometry -S1\nScore\n2/0\nAssignment\nEssay\nEnglish 10 -S1\nScore\nA-",
      LIVE,
    );
    expect(items).toEqual([]);
    expect(skipped.map(s => s.reason)).toEqual([expect.stringMatching(/Out of 0/), expect.stringMatching(/in points/i)]);
  });

  it("pending work: added when new, never overwrites an existing grade", () => {
    const parsed = parseInfiniteCampus(LIST, LIVE).items.filter(i => i.status === "pending");
    const rows = buildPlan(parsed, [a({ title: "Jobs", subject: "CE / Computer Tech I A+", status: "graded", grade: 100 })]);
    expect(rows.map(r => [r.item.title, r.kind, r.selected])).toEqual([
      ["Jobs", "unchanged", false],
      ["Listening Quiz - Weather", "new", true],
    ]);
    expect(rows[1].type).toBe("quiz");
  });

  it("missing with a 0 score is saved as missing", () => {
    const [row] = buildPlan(parseInfiniteCampus(LIST, LIVE).items.filter(i => i.title.startsWith("Quizlet")), [
      a({ title: "Quizlet Learn - Pastimes", subject: "Spanish II" }),
    ]);
    expect(row).toMatchObject({ kind: "update", selected: true, note: "pending → missing" });
  });
});

describe("near-duplicates, not-in-list, estimate", () => {
  const RULES = { ...DEFAULT_REWARD_SETTINGS };
  const list = (lines: string[]) => parseInfiniteCampus(["Thursday 09/03/2026", ...lines].join("\n"), ["Spanish II", "Geometry"]);

  it("flags a longer Campus title that starts with an app title in the same class, unticked", () => {
    const existing = a({ id: "d", title: "Daniel el Detective", subject: "Spanish II", status: "graded", grade: 93 });
    const [row] = buildPlan(list(["Assignment", "Daniel el Detective - Reading Assessment", "Spanish II -S1", "Score", "28/30(93.33%)"]).items, [existing]);
    expect(row).toMatchObject({ kind: "new", selected: false, similar: existing });
  });

  it("does not flag different classes or mere word overlap", () => {
    const rows = buildPlan(
      list([
        "Assignment", "Daniel el Detective - Reading", "Geometry -S1", "Score", "1/1",
        "Assignment", "Module 10 Review", "Geometry -S1", "Score", "1/1",
      ]).items,
      [a({ title: "Daniel el Detective", subject: "Spanish II" }), a({ id: "m", title: "Module 1", subject: "Geometry" })],
    );
    expect(rows.map(r => [r.kind, r.selected, r.similar?.id ?? null])).toEqual([["new", true, null], ["new", true, null]]);
  });

  it("lists graded/missing app work a complete list doesn't mention", () => {
    const parsed = list(["Assignment", "HW 1", "Geometry -S1", "Score", "1/1"]);
    expect(parsed.complete).toBe(true);
    const app = [a({ id: "1", title: "HW 1" }), a({ id: "2", title: "Old Quiz", status: "graded", grade: 0 }), a({ id: "3", title: "Upcoming" })];
    expect(notInList(buildPlan(parsed.items, app), app).map(x => x.id)).toEqual(["2"]);
    expect(parseInfiniteCampus("Susana received a score of 1 out of 1 on HW 1 in Geometry", []).complete).toBe(false);
  });

  it("estimates the balance change against what the ledger holds now", () => {
    const rows = buildPlan(
      list([
        "Assignment", "Unit Test", "Geometry -S1", "Score", "15/20",   // new test 75% → +20
        "Assignment", "HW 2", "Geometry -S1", "Score", "1/1",          // update from 0 recorded → +3
        "Assignment", "Quiz 3", "Geometry -S1", "Score", "5/10",       // new quiz 50% → −10
        "Assignment", "HW 4", "Geometry -S1", "Missing",               // missing → 0
      ]).items,
      [a({ id: "h", title: "HW 2", status: "graded", grade: 0, recordedReward: null })],
    );
    expect(rows.map(r => estimateDelta(r, RULES))).toEqual([20, 3, -10, 0]);
  });
});

describe("ignored items", () => {
  const parsed = () =>
    parseInfiniteCampus("Thursday 09/03/2026\nAssignment\nExtra Credit Sheet\nGeometry -S1\nScore\n5/5\nAssignment\nHW 9\nGeometry -S1\nScore\n1/1", ["Geometry"]).items;

  it("an ignored new item is shown as ignored, unticked, with its id", () => {
    const rows = buildPlan(parsed(), [], [{ id: "ig1", classKey: "geometry", titleKey: "extra credit sheet" }]);
    expect(rows.map(r => [r.item.title, r.kind, r.selected, r.ignoreId ?? null])).toEqual([
      ["Extra Credit Sheet", "ignored", false, "ig1"],
      ["HW 9", "new", true, null],
    ]);
  });

  it("matches the ignore regardless of case and punctuation", () => {
    const [row] = buildPlan(parsed(), [], [{ id: "ig1", classKey: "geometry", titleKey: "extra credit sheet" }]);
    expect(row.kind).toBe("ignored");
  });

  it("an ignore never hides work that is already in the app", () => {
    const existing = a({ id: "e", title: "Extra Credit Sheet", status: "pending" });
    const [row] = buildPlan(parsed(), [existing], [{ id: "ig1", classKey: "geometry", titleKey: "extra credit sheet" }]);
    expect(row).toMatchObject({ kind: "update", existing });
  });

  it("an ignored item isn't flagged as a near-duplicate", () => {
    const rows = buildPlan(parsed(), [a({ id: "x", title: "Extra Credit", subject: "Geometry", status: "graded", grade: 100 })], [
      { id: "ig1", classKey: "geometry", titleKey: "extra credit sheet" },
    ]);
    expect(rows[0]).toMatchObject({ kind: "ignored" });
    expect(rows[0].similar).toBeUndefined();
  });
});
