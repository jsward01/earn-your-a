import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";
import { testEmail } from "../_lib/emailAlerts";
import { sendEmail } from "../_lib/resend";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Send the signed-in user a test email at their saved alert address (Alerts → Settings), whether or not alerts are
 * switched on. One per minute per person (claimed in email_log as kind 'test', ref = the UTC minute), and logged
 * like real alerts so a failure can be looked up later.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const row = await db
    .prepare(
      `SELECT n.email_addr, u.name, u.role, u.email_alerts_allowed FROM users u
       LEFT JOIN notification_settings n ON n.user_id = u.id WHERE u.id = ?`,
    )
    .bind(user.id)
    .first<{ email_addr: string | null; name: string; role: string; email_alerts_allowed: number }>();
  const to = row?.email_addr?.trim();
  if (!to) return json({ error: "Save an email address first, then send the test." }, 400);
  if (row!.role === "student" && row!.email_alerts_allowed === 0) {
    return json({ error: "A parent has turned off email alerts for you." }, 403);
  }
  const apiKey = context.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: "Email sending isn't set up on the website yet (missing RESEND_API_KEY)." }, 503);

  const ref = new Date().toISOString().slice(0, 16);
  const claim = await db
    .prepare("INSERT OR IGNORE INTO email_log (user_id, kind, ref) VALUES (?, 'test', ?)")
    .bind(user.id, ref)
    .run();
  if (claim.meta.changes === 0) return json({ error: "A test was just sent. Wait a minute before sending another." }, 429);

  const result = await sendEmail(apiKey, to, testEmail(row!.name.split(" ")[0]), `test-${user.id}-${ref}`);
  await db
    .prepare("UPDATE email_log SET status = ?, detail = ? WHERE user_id = ? AND kind = 'test' AND ref = ?")
    .bind(result.ok ? "sent" : "failed", result.ok ? result.id : result.error, user.id, ref)
    .run();
  if (!result.ok) return json({ error: `The email service refused it: ${result.error}` }, 502);
  return json({ sentTo: to }, 200);
};
