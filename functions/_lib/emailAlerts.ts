/**
 * What the alerts Worker (workers/alerts) emails, and when. Pure functions only (no D1, no network) so the rules are
 * unit-tested; the Worker does the reading, claiming and sending.
 *
 * Timing follows the hints on the Alerts → Settings card:
 * - morning (from 7am family time): work due today + retake windows with 2 days left
 * - evening (from 5pm): work due tomorrow
 * - payouts: as soon as the next run sees them (every 15 minutes) — a student's request goes to the parents, an
 *   approval/denial goes to the student.
 * - quiet hours (each person's own, default 8pm–6am): nothing is sent. A digest that falls inside them is skipped;
 *   a payout email waits until they end.
 */
import { formatAmount, type RewardFormat } from "../../src/lib/rewards";

export type DigestKind = "morning" | "evening";

export const MORNING_HOUR = 7;
export const EVENING_HOUR = 17;
/** A window stays open a few hours so a missed run (or a Worker outage) still sends, but not at midnight. */
const WINDOW_HOURS = 4;
/** Retake reminder goes out when this many days are left (matches the card's "has 2 days left"). */
export const RETAKE_DAYS_LEFT = 2;

export const APP_URL = "https://earnyoura.com";

/** The family's local calendar date (YYYY-MM-DD) and hour for an instant. */
export function localClock(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Which digest is due at this local hour, if any. */
export function digestWindow(hour: number): DigestKind | null {
  if (hour >= MORNING_HOUR && hour < MORNING_HOUR + WINDOW_HOURS) return "morning";
  if (hour >= EVENING_HOUR && hour < EVENING_HOUR + WINDOW_HOURS) return "evening";
  return null;
}

/** Whether this local hour is inside someone's quiet hours (null = quiet hours off). Wraps past midnight when start > end. */
export function inQuietHours(hour: number, quiet: { start: number; end: number } | null): boolean {
  if (!quiet || quiet.start === quiet.end) return false;
  return quiet.start < quiet.end ? hour >= quiet.start && hour < quiet.end : hour >= quiet.start || hour < quiet.end;
}

/** Calendar arithmetic on YYYY-MM-DD strings (no time zones involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** One piece of work, as the Worker reads it. Only pending / open-retake work is ever passed in. */
export interface AlertItem {
  studentId: string;
  title: string;
  subject: string;
  type: "assignment" | "quiz" | "test";
  dueDate: string;
  status: "pending" | "graded" | "missing";
  makeupDeadline: string | null;
}

export interface Recipient {
  id: string;
  role: "parent" | "student";
  /** First name is enough for a greeting. */
  name: string;
  dueToday: boolean;
  due1day: boolean;
  makeup: boolean;
}

export interface Student {
  id: string;
  name: string;
}

export interface Email {
  subject: string;
  text: string;
  html: string;
}

interface Section {
  heading: string;
  lines: string[];
}

const TYPE_LABEL: Record<AlertItem["type"], string> = { assignment: "", quiz: " (quiz)", test: " (test)" };

function itemLine(a: AlertItem): string {
  return `${a.title}${TYPE_LABEL[a.type]} · ${a.subject}`;
}

function retakeLine(a: AlertItem): string {
  return `${itemLine(a)} · ${a.status === "missing" ? "turn it in" : "retake it"} by ${formatDate(a.makeupDeadline!)}`;
}

/** "Thu, Oct 15" from YYYY-MM-DD. */
export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function sectionsFor(kind: DigestKind, today: string, r: Recipient, items: AlertItem[]): { key: string; label: string; items: AlertItem[]; line: (a: AlertItem) => string }[] {
  if (kind === "evening") {
    const tomorrow = addDays(today, 1);
    return r.due1day ? [{ key: "tomorrow", label: "Due tomorrow", items: items.filter(a => a.status === "pending" && a.dueDate === tomorrow), line: itemLine }] : [];
  }
  const retakeBy = addDays(today, RETAKE_DAYS_LEFT);
  return [
    ...(r.dueToday ? [{ key: "today", label: "Due today", items: items.filter(a => a.status === "pending" && a.dueDate === today), line: itemLine }] : []),
    ...(r.makeup ? [{ key: "retake", label: "Retake window closes soon", items: items.filter(a => a.status !== "pending" && a.makeupDeadline === retakeBy), line: retakeLine }] : []),
  ];
}

/**
 * The morning or evening email for one person, or null when there's nothing to say (no email is sent then).
 * A student gets their own work; a parent gets every student in the family, grouped by student when there are several.
 */
export function buildDigest(kind: DigestKind, today: string, r: Recipient, students: Student[], items: AlertItem[]): Email | null {
  const mine = r.role === "student" ? items.filter(a => a.studentId === r.id) : items;
  const forParent = r.role === "parent";
  const sections: Section[] = [];
  const counts: { label: string; n: number }[] = [];

  for (const s of sectionsFor(kind, today, r, mine)) {
    if (s.items.length === 0) continue;
    counts.push({ label: s.label.toLowerCase(), n: s.items.length });
    if (!forParent || students.length <= 1) {
      sections.push({ heading: forParent && students[0] ? `${s.label} for ${students[0].name}` : s.label, lines: s.items.map(s.line) });
      continue;
    }
    for (const st of students) {
      const theirs = s.items.filter(a => a.studentId === st.id);
      if (theirs.length) sections.push({ heading: `${s.label} for ${st.name}`, lines: theirs.map(s.line) });
    }
  }
  if (sections.length === 0) return null;

  const who = forParent ? (students.length === 1 ? `${students[0].name}: ` : "") : "";
  const first = counts[0];
  const subject =
    kind === "evening"
      ? `${who}${first.n} ${first.n === 1 ? "thing" : "things"} due tomorrow`
      : first.label === "due today"
        ? `${who}${first.n} due today${counts.length > 1 ? " + a retake closing" : ""}`
        : `${who}Retake window closes ${formatDate(addDays(today, RETAKE_DAYS_LEFT))}`;

  return render(subject, `Hi ${r.name},`, sections);
}

export interface PayoutInfo {
  studentName: string;
  amount: number;
  status: "pending" | "paid" | "denied";
}

/** A student's request (to each parent) or a parent's decision (to the student). */
export function buildPayoutEmail(r: Recipient, p: PayoutInfo, fmt: RewardFormat): Email {
  const amount = formatAmount(p.amount, fmt);
  if (r.role === "parent") {
    return render(`${p.studentName} asked for a payout of ${amount}`, `Hi ${r.name},`, [
      { heading: "Payout request", lines: [`${p.studentName} asked to cash out ${amount}. Approve or deny it on the Overview.`] },
    ]);
  }
  const approved = p.status === "paid";
  return render(approved ? `Your payout of ${amount} was approved` : `Your payout request of ${amount} was denied`, `Hi ${r.name},`, [
    {
      heading: approved ? "Payout approved" : "Payout denied",
      lines: [approved ? `A parent approved your payout of ${amount}. They'll pay you directly.` : `A parent denied your payout request of ${amount}. Ask them why, or try again later.`],
    },
  ]);
}

/** One unread message, as the Worker reads it. */
export interface MessageAlertItem {
  senderName: string;
  body: string;
}

/** At most this many messages are quoted in one email; the rest are counted. */
export const MESSAGE_EMAIL_MAX = 5;
const MESSAGE_PREVIEW_CHARS = 300;

/**
 * Unread messages in one family chat. `studentName` is the student the chat is with (the recipient's own chat when
 * they're the student). Quotes the latest few, oldest first.
 */
export function buildMessageEmail(r: Recipient, studentName: string, messages: MessageAlertItem[]): Email {
  const senders = [...new Set(messages.map(m => m.senderName))];
  const subject =
    messages.length === 1
      ? `New message from ${senders[0]}`
      : senders.length === 1
        ? `${messages.length} new messages from ${senders[0]}`
        : `${messages.length} new messages in ${r.role === "parent" ? `your chat with ${studentName}` : "your family chat"}`;
  const shown = messages.slice(-MESSAGE_EMAIL_MAX);
  const lines = shown.map(m => {
    const text = m.body.replace(/\s+/g, " ");
    return `${m.senderName}: ${text.length > MESSAGE_PREVIEW_CHARS ? `${text.slice(0, MESSAGE_PREVIEW_CHARS)}…` : text}`;
  });
  const hidden = messages.length - shown.length;
  if (hidden > 0) lines.unshift(`…and ${hidden} earlier message${hidden === 1 ? "" : "s"} (open the app to read them)`);
  return render(subject, `Hi ${r.name},`, [
    { heading: r.role === "parent" ? `Family chat with ${studentName}` : "Family chat", lines: [...lines, "Reply in the app under Messages."] },
  ]);
}

const FOOTER = "You're getting this because email alerts are on in Earn Your A. To change them, open the app → Alerts → ⚙️ Settings.";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render(subject: string, greeting: string, sections: Section[]): Email {
  const text = [
    greeting,
    "",
    ...sections.flatMap(s => [s.heading, ...s.lines.map(l => `- ${l}`), ""]),
    `Open Earn Your A: ${APP_URL}`,
    "",
    FOOTER,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:15px">${escapeHtml(greeting)}</p>
${sections
  .map(
    s => `<p style="margin:16px 0 6px;font-size:13px;font-weight:600;color:#4f46e5;text-transform:uppercase;letter-spacing:.03em">${escapeHtml(s.heading)}</p>
<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.5">${s.lines.map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
  )
  .join("\n")}
<p style="margin:24px 0 0"><a href="${APP_URL}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">Open Earn Your A</a></p>
</div>
<p style="max-width:520px;margin:12px auto 0;font-size:12px;color:#6b7280">${escapeHtml(FOOTER)}</p>
</body></html>`;

  return { subject, text, html };
}

/** "Send test email" (Alerts → Settings): a sample in the same layout as real alerts, so it's also a look at how they render. */
export function testEmail(firstName: string): Email {
  return render("Earn Your A: test email", `Hi ${firstName}, this is a test from Earn Your A. If you can read this, email alerts reach you.`, [
    {
      heading: "What you'll get",
      lines: [
        "Around 7 AM: work due today, and retake windows closing in 2 days",
        "Around 5 PM: work due tomorrow",
        "Payout requests and approvals, within about 15 minutes",
        "New messages you haven't read, within about 15 minutes",
        "No email on days with nothing to say",
      ],
    },
  ]);
}
