/**
 * Email alert settings, one row per user in `notification_settings` (each parent and
 * each student picks their own). Only the columns email alerts use are read or written;
 * the SMS / in-app / weekly / quiet-hours columns from 0001_init stay untouched until
 * those features exist.
 */
export interface EmailAlertSettings {
  email: boolean;
  emailAddr: string;
  due1day: boolean;
  dueToday: boolean;
  makeup: boolean;
  payout: boolean;
}

export interface NotificationSettingsRow {
  email: number;
  email_addr: string | null;
  due_1day: number;
  due_today: number;
  makeup: number;
  payout: number;
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
  };
}

export function fromRow(row: NotificationSettingsRow): EmailAlertSettings {
  return {
    email: row.email === 1,
    emailAddr: row.email_addr ?? "",
    due1day: row.due_1day === 1,
    dueToday: row.due_today === 1,
    makeup: row.makeup === 1,
    payout: row.payout === 1,
  };
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
  return {
    email: b.email as boolean,
    emailAddr,
    due1day: b.due1day as boolean,
    dueToday: b.dueToday as boolean,
    makeup: b.makeup as boolean,
    payout: b.payout as boolean,
  };
}
