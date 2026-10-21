import type { Assignment } from "../types";
import { classKey } from "./import/normalize";

/** One Sun–Sat week (by due date) on a progress chart. */
export interface WeekPoint {
  /** The week's Sunday, "YYYY-MM-DD". */
  week: string;
  value: number;
  /** How many items went into it. */
  count: number;
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The Sunday that starts the week a "YYYY-MM-DD" date falls in (local calendar, like the Weekly screen). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  day.setDate(day.getDate() - day.getDay());
  return ymd(day);
}

/** Earliest due date for a range: this school year (from July 1) or the last 8 weeks. */
export function rangeStart(range: "year" | "recent", now: Date = new Date()): string {
  if (range === "year") return `${now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1}-07-01`;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * 7); // this week + the 7 before it
  return weekStart(ymd(d));
}

/** The classes in the student's work, merged by class key ("Spanish II" and "spanish ii" are one), sorted by name. */
export function progressClasses(assignments: Assignment[]): { key: string; name: string }[] {
  const byKey = new Map<string, string>();
  for (const a of assignments) {
    const key = classKey(a.subject);
    if (key && !byKey.has(key)) byKey.set(key, a.subject.trim());
  }
  return [...byKey.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Average grade per week (by due date), the way Class Averages counts it: every graded item's %, missing work as 0.
 * Covers all work, including history and Track only classes (they're tracked, just not paid). `classKeyFilter` keeps
 * one class. Weeks with nothing graded are left out (no point, the line skips to the next one).
 */
export function weeklyGrades(assignments: Assignment[], since: string, classKeyFilter: string | null = null, today: string = ymd(new Date())): WeekPoint[] {
  const weeks = new Map<string, { sum: number; count: number }>();
  for (const a of assignments) {
    if (a.dueDate < since || a.dueDate > today) continue;
    if (classKeyFilter && classKey(a.subject) !== classKeyFilter) continue;
    const score = a.status === "graded" && a.grade !== null ? a.grade : a.status === "missing" ? 0 : null;
    if (score === null) continue;
    const w = weekStart(a.dueDate);
    const entry = weeks.get(w) ?? { sum: 0, count: 0 };
    entry.sum += score;
    entry.count++;
    weeks.set(w, entry);
  }
  return [...weeks.entries()]
    .map(([week, e]) => ({ week, value: Math.round(e.sum / e.count), count: e.count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export interface MoneyWeek {
  week: string;
  /** Net for the week (earned − lost). */
  value: number;
  earned: number;
  lost: number;
  count: number;
}

const roundCents = (n: number): number => Math.round(n * 100) / 100;

/**
 * Net rewards per week, dated by each item's due date (not when it was entered, so a big catch-up import doesn't land
 * in one week). Uses what the ledger recorded for each item (including rate-change catch-ups); history and Track only
 * work never has any. Adjustments and payouts aren't tied to work, so they're not here. Every week from the first
 * one with money through this week is listed, so quiet weeks show as $0.
 */
export function weeklyEarnings(assignments: Assignment[], since: string, today: string = ymd(new Date())): MoneyWeek[] {
  const weeks = new Map<string, MoneyWeek>();
  for (const a of assignments) {
    const amount = a.recordedReward ?? 0;
    if (amount === 0 || a.dueDate < since || a.dueDate > today) continue;
    const w = weekStart(a.dueDate);
    const entry = weeks.get(w) ?? { week: w, value: 0, earned: 0, lost: 0, count: 0 };
    if (amount > 0) entry.earned = roundCents(entry.earned + amount);
    else entry.lost = roundCents(entry.lost - amount);
    entry.value = roundCents(entry.earned - entry.lost);
    entry.count++;
    weeks.set(w, entry);
  }
  if (weeks.size === 0) return [];
  const first = [...weeks.keys()].sort()[0];
  const last = weekStart(today);
  const out: MoneyWeek[] = [];
  const [y, m, d] = first.split("-").map(Number);
  for (const cur = new Date(y, m - 1, d); ymd(cur) <= last; cur.setDate(cur.getDate() + 7)) {
    const w = ymd(cur);
    out.push(weeks.get(w) ?? { week: w, value: 0, earned: 0, lost: 0, count: 0 });
  }
  return out;
}

/** "Oct 12" for a "YYYY-MM-DD" week start. */
export function weekLabel(week: string): string {
  const [y, m, d] = week.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
