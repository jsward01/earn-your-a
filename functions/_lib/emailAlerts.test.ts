import { describe, expect, it } from "vitest";
import { addDays, buildDigest, buildPayoutEmail, digestWindow, formatDate, inQuietHours, localClock, testEmail, type AlertItem, type Recipient } from "./emailAlerts";

const TODAY = "2026-10-14";
const sam: Recipient = { id: "s1", role: "student", name: "Sam", dueToday: true, due1day: true, makeup: true };
const pat: Recipient = { id: "p1", role: "parent", name: "Pat", dueToday: true, due1day: true, makeup: true };
const students = [{ id: "s1", name: "Sam" }];

function item(over: Partial<AlertItem>): AlertItem {
  return { studentId: "s1", title: "Worksheet 3", subject: "Biology", type: "assignment", dueDate: TODAY, status: "pending", makeupDeadline: null, ...over };
}

describe("localClock / digestWindow", () => {
  it("reads the family's local date, not UTC", () => {
    // 03:30 UTC on Oct 15 is still the evening of Oct 14 in Denver (MDT, UTC-6).
    expect(localClock(new Date("2026-10-15T03:30:00Z"), "America/Denver")).toEqual({ date: "2026-10-14", hour: 21 });
    expect(localClock(new Date("2026-10-14T13:05:00Z"), "America/Denver")).toEqual({ date: "2026-10-14", hour: 7 });
  });
  it("handles standard time after the November switch", () => {
    expect(localClock(new Date("2026-11-10T14:00:00Z"), "America/Denver")).toEqual({ date: "2026-11-10", hour: 7 });
  });
  it("opens a morning window from 7 and an evening window from 5pm, closed overnight", () => {
    expect(digestWindow(6)).toBeNull();
    expect(digestWindow(7)).toBe("morning");
    expect(digestWindow(10)).toBe("morning");
    expect(digestWindow(11)).toBeNull();
    expect(digestWindow(16)).toBeNull();
    expect(digestWindow(17)).toBe("evening");
    expect(digestWindow(20)).toBe("evening");
    expect(digestWindow(21)).toBeNull();
    expect(digestWindow(0)).toBeNull();
  });
  it("keeps quiet hours, wrapping past midnight", () => {
    const night = { start: 20, end: 6 };
    expect([19, 20, 23, 0, 4, 5, 6, 18].map(h => inQuietHours(h, night))).toEqual([false, true, true, true, true, true, false, false]);
    const nap = { start: 13, end: 15 };
    expect([12, 13, 14, 15].map(h => inQuietHours(h, nap))).toEqual([false, true, true, false]);
    expect(inQuietHours(3, null)).toBe(false);
  });
  it("adds calendar days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 2)).toBe("2027-01-02");
    expect(formatDate("2026-10-16")).toBe("Fri, Oct 16");
  });
});

describe("buildDigest", () => {
  it("sends nothing when nothing is due", () => {
    expect(buildDigest("morning", TODAY, sam, students, [])).toBeNull();
    expect(buildDigest("evening", TODAY, sam, students, [item({ dueDate: TODAY })])).toBeNull();
  });

  it("morning: lists work due today and retakes with 2 days left", () => {
    const email = buildDigest("morning", TODAY, sam, students, [
      item({ title: "Worksheet 3" }),
      item({ title: "Unit 2 Test", type: "test", status: "graded", dueDate: "2026-10-01", makeupDeadline: "2026-10-16" }),
      item({ title: "Tomorrow thing", dueDate: "2026-10-15" }),
    ])!;
    expect(email.subject).toBe("1 due today + a retake closing");
    expect(email.text).toContain("Due today\n- Worksheet 3 · Biology");
    expect(email.text).toContain("Retake window closes soon\n- Unit 2 Test (test) · Biology · retake it by Fri, Oct 16");
    expect(email.text).not.toContain("Tomorrow thing");
  });

  it("evening: lists work due tomorrow", () => {
    const email = buildDigest("evening", TODAY, sam, students, [item({ title: "Essay", dueDate: "2026-10-15" }), item({ title: "Quiz 4", type: "quiz", dueDate: "2026-10-15" })])!;
    expect(email.subject).toBe("2 things due tomorrow");
    expect(email.text).toContain("- Quiz 4 (quiz) · Biology");
  });

  it("only includes the kinds of alerts the person turned on", () => {
    const retakeOnly = { ...sam, dueToday: false };
    const items = [item({}), item({ title: "Missing HW", status: "missing", makeupDeadline: "2026-10-16" })];
    const email = buildDigest("morning", TODAY, retakeOnly, students, items)!;
    expect(email.subject).toBe("Retake window closes Fri, Oct 16");
    expect(email.text).toContain("Missing HW · Biology · turn it in by");
    expect(email.text).not.toContain("Worksheet 3");
    expect(buildDigest("evening", TODAY, { ...sam, due1day: false }, students, [item({ dueDate: "2026-10-15" })])).toBeNull();
  });

  it("a student never sees a sibling's work; a parent sees each child by name", () => {
    const two = [{ id: "s1", name: "Sam" }, { id: "s2", name: "Alex" }];
    const items = [item({ title: "Sam work" }), item({ studentId: "s2", title: "Alex work" })];
    const forSam = buildDigest("morning", TODAY, sam, two, items)!;
    expect(forSam.text).toContain("Sam work");
    expect(forSam.text).not.toContain("Alex work");
    const forPat = buildDigest("morning", TODAY, pat, two, items)!;
    expect(forPat.text).toContain("Due today for Sam\n- Sam work");
    expect(forPat.text).toContain("Due today for Alex\n- Alex work");
    expect(forPat.subject).toBe("2 due today");
  });

  it("names the only student in a parent's subject", () => {
    expect(buildDigest("morning", TODAY, pat, students, [item({})])!.subject).toBe("Sam: 1 due today");
  });

  it("escapes titles in the HTML version", () => {
    const email = buildDigest("morning", TODAY, sam, students, [item({ title: "<b>Lab</b> & notes" })])!;
    expect(email.html).toContain("&lt;b&gt;Lab&lt;/b&gt; &amp; notes");
    expect(email.html).not.toContain("<b>Lab</b>");
  });
});

describe("buildPayoutEmail", () => {
  const money = { rewardType: "money" as const, customUnit: "" };
  it("tells parents about a request", () => {
    const e = buildPayoutEmail(pat, { studentName: "Sam", amount: 99, status: "pending" }, money);
    expect(e.subject).toBe("Sam asked for a payout of $99.00");
  });
  it("tells the student about the decision, in the family's units", () => {
    expect(buildPayoutEmail(sam, { studentName: "Sam", amount: 99, status: "paid" }, money).subject).toBe("Your payout of $99.00 was approved");
    expect(buildPayoutEmail(sam, { studentName: "Sam", amount: 30, status: "denied" }, { rewardType: "screen", customUnit: "" }).subject).toBe(
      "Your payout request of 30 min was denied",
    );
  });
});

describe("testEmail", () => {
  it("greets by first name in the alert layout, with a plain-text copy", () => {
    const e = testEmail("Jonathan");
    expect(e.subject).toBe("Earn Your A: test email");
    expect(e.text).toContain("Hi Jonathan");
    expect(e.text).toContain("Around 5 PM: work due tomorrow");
    expect(e.html).toContain("Open Earn Your A");
  });

  it("escapes the name in the HTML", () => {
    expect(testEmail("<b>").html).not.toContain("<b>,");
  });
});
