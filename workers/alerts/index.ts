/**
 * earn-your-a-alerts: a scheduled Worker (Pages has no cron) that sends the email alerts people turned on in
 * Alerts → ⚙️ Settings. Runs every 15 minutes against the same D1 database as the site. See functions/_lib/emailAlerts.ts
 * for what gets sent when. Deployed separately from the site: `npx wrangler deploy -c workers/alerts/wrangler.jsonc`.
 *
 * Every email is claimed in `email_log` (primary key user + kind + ref) before it is sent, so nothing goes out twice.
 * Without a RESEND_API_KEY secret the Worker only logs what it would send (that's how it runs locally).
 */
import {
  addDays,
  buildDigest,
  buildMessageEmail,
  buildPayoutEmail,
  digestWindow,
  inQuietHours,
  localClock,
  RETAKE_DAYS_LEFT,
  type AlertItem,
  type Email,
  type MessageAlertItem,
  type Recipient,
  type Student,
} from "../../functions/_lib/emailAlerts";
import { quietHoursFromRow } from "../../functions/_lib/notificationSettings";
import { sendEmail } from "../../functions/_lib/resend";
import type { RewardFormat } from "../../src/lib/rewards";

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
}

interface RecipientRow {
  id: string;
  family_id: string;
  role: "parent" | "student";
  name: string;
  email_addr: string;
  due_1day: number;
  due_today: number;
  makeup: number;
  payout: number;
  messages: number;
  messaging_allowed: number;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
}

/** Payout events older than this are never emailed (so turning email on doesn't send a pile of old news). */
const PAYOUT_LOOKBACK = "-2 days";
/** Messages are emailed only after sitting unread this long, so a chat that's being read live sends no email. */
const MESSAGE_GRACE = "-5 minutes";
/** Same idea as PAYOUT_LOOKBACK: older unread messages are never emailed. */
const MESSAGE_LOOKBACK = "-2 days";

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runAlerts(env, new Date());
  },
  // No public pages: the Worker exists only for its schedule.
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export async function runAlerts(env: Env, now: Date): Promise<void> {
  // Everyone with email on and an address. A student's own alerts also need their parents' "Allow email alerts".
  const { results: rows } = await env.DB.prepare(
    `SELECT u.id, u.family_id, u.role, u.name, ns.email_addr, ns.due_1day, ns.due_today, ns.makeup, ns.payout, ns.messages, u.messaging_allowed,
            ns.quiet_start, ns.quiet_end, f.timezone
     FROM notification_settings ns
     JOIN users u ON u.id = ns.user_id
     JOIN families f ON f.id = u.family_id
     WHERE ns.email = 1 AND ns.email_addr IS NOT NULL AND ns.email_addr != ''
       AND (u.role = 'parent' OR u.email_alerts_allowed = 1)`,
  ).all<RecipientRow>();
  if (rows.length === 0) return;

  const byFamily = new Map<string, RecipientRow[]>();
  for (const r of rows) byFamily.set(r.family_id, [...(byFamily.get(r.family_id) ?? []), r]);

  for (const [familyId, recipients] of byFamily) {
    try {
      await runFamily(env, now, familyId, recipients);
    } catch (e) {
      // One family's problem must not stop the others.
      console.error(`alerts: family ${familyId} failed`, e);
    }
  }
}

async function runFamily(env: Env, now: Date, familyId: string, allRecipients: RecipientRow[]): Promise<void> {
  const { date: today, hour } = localClock(now, allRecipients[0].timezone);
  // Inside someone's quiet hours nothing goes to them this run: a digest is skipped, a payout email waits.
  const recipients = allRecipients.filter(r => !inQuietHours(hour, quietHoursFromRow(r)));
  if (recipients.length === 0) return;
  const { results: studentRows } = await env.DB.prepare(
    "SELECT id, name FROM users WHERE family_id = ? AND role = 'student' ORDER BY created_at, id",
  )
    .bind(familyId)
    .all<Student>();
  const students = studentRows.map(s => ({ id: s.id, name: firstName(s.name) }));

  const kind = digestWindow(hour);
  if (kind) {
    const dates = kind === "morning" ? [today] : [addDays(today, 1)];
    const { results: items } = await env.DB.prepare(
      `SELECT student_id AS studentId, title, subject, type, due_date AS dueDate, status, makeup_deadline AS makeupDeadline
       FROM assignments
       WHERE family_id = ? AND history_only = 0 AND payout_id IS NULL
         AND ((status = 'pending' AND due_date = ?) OR (status != 'pending' AND makeup_deadline = ?))
       ORDER BY due_date, subject, title`,
    )
      .bind(familyId, dates[0], kind === "morning" ? addDays(today, RETAKE_DAYS_LEFT) : "")
      .all<AlertItem>();

    for (const r of recipients) {
      const email = buildDigest(kind, today, toRecipient(r), students, items);
      if (email) await deliver(env, r, kind, today, email);
    }
  }

  await sendMessageAlerts(env, recipients, students);

  const payoutRecipients = recipients.filter(r => r.payout === 1);
  if (payoutRecipients.length === 0) return;

  const { results: payouts } = await env.DB.prepare(
    `SELECT p.id, p.student_id, p.amount, p.status, u.name AS student_name
     FROM payout_requests p JOIN users u ON u.id = p.student_id
     WHERE p.family_id = ?
       AND ((p.status = 'pending' AND p.requested_at >= datetime('now', ?))
         OR (p.status IN ('paid', 'denied') AND p.resolved_at >= datetime('now', ?)))`,
  )
    .bind(familyId, PAYOUT_LOOKBACK, PAYOUT_LOOKBACK)
    .all<{ id: string; student_id: string; amount: number; status: "pending" | "paid" | "denied"; student_name: string }>();
  if (payouts.length === 0) return;

  const fmt =
    (await env.DB.prepare("SELECT reward_type AS rewardType, custom_unit AS customUnit FROM reward_settings WHERE family_id = ?")
      .bind(familyId)
      .first<RewardFormat>()) ?? { rewardType: "money", customUnit: "" };

  for (const p of payouts) {
    const info = { studentName: firstName(p.student_name), amount: p.amount, status: p.status };
    const to = p.status === "pending" ? payoutRecipients.filter(r => r.role === "parent") : payoutRecipients.filter(r => r.id === p.student_id);
    const logKind = p.status === "pending" ? "payout_requested" : "payout_resolved";
    for (const r of to) await deliver(env, r, logKind, p.id, buildPayoutEmail(toRecipient(r), info, fmt));
  }
}

/**
 * "New messages" emails: per person and per family chat they're in, the messages from others that they haven't read
 * and haven't been emailed about, once they've sat unread for MESSAGE_GRACE. `message_reads.emailed_rowid` moves past
 * what was sent, so each email covers only what's new.
 */
async function sendMessageAlerts(env: Env, recipients: RecipientRow[], students: Student[]): Promise<void> {
  for (const r of recipients) {
    if (r.messages !== 1) continue;
    if (r.role === "student" && r.messaging_allowed !== 1) continue;
    const chats = r.role === "student" ? students.filter(s => s.id === r.id) : students;
    for (const chat of chats) {
      const { results } = await env.DB.prepare(
        `SELECT m.rowid AS seq, u.name AS sender_name, m.body
         FROM messages m JOIN users u ON u.id = m.sender_id
         JOIN users st ON st.id = m.student_id AND st.messaging_allowed = 1
         LEFT JOIN message_reads mr ON mr.user_id = ? AND mr.student_id = m.student_id
         WHERE m.student_id = ? AND m.sender_id != ?
           AND m.rowid > MAX(COALESCE(mr.read_rowid, 0), COALESCE(mr.emailed_rowid, 0))
           AND m.created_at <= datetime('now', ?) AND m.created_at >= datetime('now', ?)
         ORDER BY m.rowid`,
      )
        .bind(r.id, chat.id, r.id, MESSAGE_GRACE, MESSAGE_LOOKBACK)
        .all<{ seq: number; sender_name: string; body: string }>();
      if (results.length === 0) continue;

      const items: MessageAlertItem[] = results.map(m => ({ senderName: firstName(m.sender_name), body: m.body }));
      const last = results[results.length - 1].seq;
      const outcome = await deliver(env, r, "message", `${chat.id}/${last}`, buildMessageEmail(toRecipient(r), chat.name, items));
      // Sent, already sent, or failed for good: don't email these messages again. A retryable error tries next run.
      if (outcome === "sent" || outcome === "duplicate" || outcome === "failed") {
        await env.DB.prepare(
          `INSERT INTO message_reads (user_id, student_id, emailed_rowid) VALUES (?, ?, ?)
           ON CONFLICT (user_id, student_id) DO UPDATE SET emailed_rowid = MAX(emailed_rowid, excluded.emailed_rowid)`,
        )
          .bind(r.id, chat.id, last)
          .run();
      }
    }
  }
}

function toRecipient(r: RecipientRow): Recipient {
  return { id: r.id, role: r.role, name: firstName(r.name), dueToday: r.due_today === 1, due1day: r.due_1day === 1, makeup: r.makeup === 1 };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

type Outcome = "dry-run" | "duplicate" | "sent" | "retry" | "failed";

async function deliver(env: Env, r: RecipientRow, kind: string, ref: string, email: Email): Promise<Outcome> {
  if (!env.RESEND_API_KEY) {
    console.log(`alerts [dry run, no RESEND_API_KEY] ${kind}/${ref} → ${r.email_addr}: ${email.subject}\n${email.text}`);
    return "dry-run";
  }
  const claim = await env.DB.prepare("INSERT OR IGNORE INTO email_log (user_id, kind, ref) VALUES (?, ?, ?)").bind(r.id, kind, ref).run();
  if (claim.meta.changes !== 1) return "duplicate"; // already sent (or being sent by an overlapping run)

  const result = await sendEmail(env.RESEND_API_KEY, r.email_addr, email, `${kind}/${r.id}/${ref}`);
  if (result.ok) {
    await env.DB.prepare("UPDATE email_log SET status = 'sent', detail = ? WHERE user_id = ? AND kind = ? AND ref = ?")
      .bind(result.id, r.id, kind, ref)
      .run();
    return "sent";
  } else if (result.retryable) {
    console.warn(`alerts: ${kind}/${ref} to ${r.id} will retry: ${result.error}`);
    await env.DB.prepare("DELETE FROM email_log WHERE user_id = ? AND kind = ? AND ref = ?").bind(r.id, kind, ref).run();
    return "retry";
  } else {
    console.error(`alerts: ${kind}/${ref} to ${r.id} failed: ${result.error}`);
    await env.DB.prepare("UPDATE email_log SET status = 'failed', detail = ? WHERE user_id = ? AND kind = ? AND ref = ?")
      .bind(result.error.slice(0, 500), r.id, kind, ref)
      .run();
    return "failed";
  }
}
