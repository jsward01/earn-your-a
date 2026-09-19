/** "+$5.00", "-$3.00", "$0.00" — a signed ledger amount. */
export function signedMoney(amount: number | null | undefined): string {
  const n = amount ?? 0;
  if (n > 0) return `+$${n.toFixed(2)}`;
  if (n < 0) return `-$${Math.abs(n).toFixed(2)}`;
  return "$0.00";
}

export function plainMoney(amount: number): string {
  return `${amount < 0 ? "-" : ""}$${Math.abs(amount).toFixed(2)}`;
}

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
