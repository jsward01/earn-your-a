/** D1's datetime('now') is UTC "YYYY-MM-DD HH:MM:SS"; show it in the viewer's timezone. */
export function parseDbTime(s: string): Date {
  return new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
}

export function shortDate(s: string): string {
  return parseDbTime(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function shortDateTime(s: string): string {
  return parseDbTime(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Whole days from today (local midnight) until a "YYYY-MM-DD" due date; negative once it is past.
 * The date is read as a local calendar day. `new Date("2026-09-22")` is UTC midnight, which after
 * ~6pm in Mountain time is already "tomorrow" locally and made "Due Tomorrow" show as "Due Today".
 */
export function daysUntilDate(dateStr: string, now: Date = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
