/**
 * Email alert settings, one row per user in `notification_settings` (each parent and
 * each student picks their own). Only the columns email alerts use are read or written;
 * the SMS / in-app / weekly columns from 0001_init stay untouched until those features exist.
 *
 * Quiet hours live in the 0001_init `quiet_start` / `quiet_end` TEXT columns as "HH:00" in the
 * family's time zone. NULL (never saved) means the default 8pm–6am; an empty string means the
 * person turned quiet hours off.
 */
export interface EmailAlertSettings {
  email: boolean;
  emailAddr: string;
  due1day: boolean;
  dueToday: boolean;
  makeup: boolean;
  payout: boolean;
  quietHours: boolean;
  /** Local hours, 0–23: no email from quietStart until quietEnd (wrapping past midnight when start > end). */
  quietStart: number;
  quietEnd: number;
}

export const DEFAULT_QUIET_START = 20;
export const DEFAULT_QUIET_END = 6;

export interface NotificationSettingsRow {
  email: number;
  email_addr: string | null;
  due_1day: number;
  due_today: number;
  makeup: number;
  payout: number;
  quiet_start: string | null;
  quiet_end: string | null;
}

export const MAX_EMAIL_LENGTH = 254;

// Deliberately loose: one @, something on each side, a dot in the domain, no spaces.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailAddress(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}

/**
 * Settings for a user who has never saved any. Email starts OFF — nothing was ever
 * emailed before, so that's the existing behavior — and the address is pre-filled
 * from the login email when it looks like a real address.
 */
export function defaultEmailAlertSettings(loginEmail: string): EmailAlertSettings {
  return {
    email: false,
    emailAddr: isEmailAddress(loginEmail) ? loginEmail : "",
    due1day: true,
    dueToday: true,
    makeup: true,
    payout: true,
    quietHours: true,
    quietStart: DEFAULT_QUIET_START,
    quietEnd: DEFAULT_QUIET_END,
  };
}

function parseHour(value: string): number | null {
  const m = /^(\d{1,2}):00$/.exec(value);
  const hour = m ? Number(m[1]) : NaN;
  return hour >= 0 && hour <= 23 ? hour : null;
}

/** The stored quiet hours as { start, end }, or null when they're off. Anything unreadable falls back to the default. */
export function quietHoursFromRow(row: Pick<NotificationSettingsRow, "quiet_start" | "quiet_end">): { start: number; end: number } | null {
  if (row.quiet_start === "" || row.quiet_end === "") return null;
  const start = row.quiet_start === null ? null : parseHour(row.quiet_start);
  const end = row.quiet_end === null ? null : parseHour(row.quiet_end);
  if (start === null || end === null || start === end) return { start: DEFAULT_QUIET_START, end: DEFAULT_QUIET_END };
  return { start, end };
}

/** The values to store in quiet_start / quiet_end. */
export function quietHoursToRow(s: Pick<EmailAlertSettings, "quietHours" | "quietStart" | "quietEnd">): { quiet_start: string; quiet_end: string } {
  if (!s.quietHours) return { quiet_start: "", quiet_end: "" };
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return { quiet_start: hh(s.quietStart), quiet_end: hh(s.quietEnd) };
}

export function fromRow(row: NotificationSettingsRow): EmailAlertSettings {
  const quiet = quietHoursFromRow(row);
  return {
    email: row.email === 1,
    emailAddr: row.email_addr ?? "",
    due1day: row.due_1day === 1,
    dueToday: row.due_today === 1,
    makeup: row.makeup === 1,
    payout: row.payout === 1,
    quietHours: quiet !== null,
    quietStart: quiet?.start ?? DEFAULT_QUIET_START,
    quietEnd: quiet?.end ?? DEFAULT_QUIET_END,
  };
}

function isHour(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 23;
}

/** Check a save request. Turning email on requires a valid address; an address may be kept while email is off. */
export function validateEmailAlertSettings(body: unknown): EmailAlertSettings | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const flags = ["email", "due1day", "dueToday", "makeup", "payout"] as const;
  for (const key of flags) {
    if (typeof b[key] !== "boolean") return { error: `${key} must be true or false` };
  }
  if (b.emailAddr !== undefined && typeof b.emailAddr !== "string") return { error: "Email address must be text" };
  const emailAddr = typeof b.emailAddr === "string" ? b.emailAddr.trim().toLowerCase() : "";
  if (emailAddr && !isEmailAddress(emailAddr)) return { error: "That doesn't look like an email address" };
  if (b.email && !emailAddr) return { error: "Enter an email address to turn on email alerts" };

  // Quiet hours are optional in the request (a page loaded before they existed doesn't send them): default 8pm–6am.
  let quietHours = true;
  let quietStart = DEFAULT_QUIET_START;
  let quietEnd = DEFAULT_QUIET_END;
  if (b.quietHours !== undefined) {
    if (typeof b.quietHours !== "boolean") return { error: "quietHours must be true or false" };
    quietHours = b.quietHours;
    if (quietHours) {
      if (!isHour(b.quietStart) || !isHour(b.quietEnd)) return { error: "Quiet hours need a start and end hour" };
      if (b.quietStart === b.quietEnd) return { error: "Quiet hours can't start and end at the same time" };
      quietStart = b.quietStart;
      quietEnd = b.quietEnd;
    }
  }

  return {
    email: b.email as boolean,
    emailAddr,
    due1day: b.due1day as boolean,
    dueToday: b.dueToday as boolean,
    makeup: b.makeup as boolean,
    payout: b.payout as boolean,
    quietHours,
    quietStart,
    quietEnd,
  };
}
