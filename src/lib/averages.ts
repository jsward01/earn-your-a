import type { Assignment } from "../types";

export interface ClassAverage {
  subject: string;
  /** Rounded %, missing work counted as 0; null when the class has nothing graded or missing in the period. */
  average: number | null;
  graded: number;
  missing: number;
}

export type AveragePeriod = "year" | "recent";

/**
 * First day of the school year a date falls in: July 1 (a date in Jan–Jun belongs to the year that started the
 * previous July). Returned as "YYYY-MM-DD" so it compares directly with due dates.
 */
export function schoolYearStart(now: Date = new Date()): string {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
}

/** Earliest due date a period covers: this school year, or the last 28 days. */
export function periodStart(period: AveragePeriod, now: Date = new Date()): string {
  if (period === "year") return schoolYearStart(now);
  const d = new Date(now);
  d.setDate(d.getDate() - 28);
  return d.toLocaleDateString("en-CA");
}

/**
 * A plain average per class of every graded item due on/after `since`, with missing work counting as 0 (as most
 * gradebooks do). Not the school's weighted grade (categories like Tests 60% aren't known), so it can differ a bit.
 * Pending, dropped-on-import and not-yet-due work is left out. Classes sort by name.
 */
export function classAverages(assignments: Assignment[], since: string): ClassAverage[] {
  const byClass = new Map<string, { sum: number; graded: number; missing: number }>();
  for (const a of assignments) {
    if (a.dueDate < since) continue;
    const isGraded = a.status === "graded" && a.grade !== null;
    const isMissing = a.status === "missing";
    if (!isGraded && !isMissing) continue;
    const subject = a.subject.trim() || "Other";
    const c = byClass.get(subject) ?? { sum: 0, graded: 0, missing: 0 };
    if (isGraded) {
      c.sum += a.grade!;
      c.graded++;
    } else {
      c.missing++;
    }
    byClass.set(subject, c);
  }
  return [...byClass.entries()]
    .map(([subject, c]) => ({
      subject,
      average: c.graded + c.missing > 0 ? Math.round(c.sum / (c.graded + c.missing)) : null,
      graded: c.graded,
      missing: c.missing,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}
