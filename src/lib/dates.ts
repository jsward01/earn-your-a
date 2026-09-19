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
