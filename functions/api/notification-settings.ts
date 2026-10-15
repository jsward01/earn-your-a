import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";
import {
  defaultEmailAlertSettings,
  fromRow,
  quietHoursToRow,
  validateEmailAlertSettings,
  type NotificationSettingsRow,
} from "../_lib/notificationSettings";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Students only: a parent can turn off all alert emails to a student (Settings → Family). Parents are always allowed. */
async function allowedByParent(db: D1Database, user: { id: string; role: string }): Promise<boolean> {
  if (user.role !== "student") return true;
  const row = await db.prepare("SELECT email_alerts_allowed FROM users WHERE id = ?").bind(user.id).first<{ email_alerts_allowed: number }>();
  return row?.email_alerts_allowed !== 0;
}

// Settings belong to the signed-in user (parent or student), never to a ?studentId= —
// a parent can't read or change their student's email address from here.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const row = await context.env.DB
    .prepare("SELECT email, email_addr, due_1day, due_today, makeup, payout, quiet_start, quiet_end FROM notification_settings WHERE user_id = ?")
    .bind(user.id)
    .first<NotificationSettingsRow>();

  const settings = row ? fromRow(row) : defaultEmailAlertSettings(user.email);
  return json({ ...settings, allowedByParent: await allowedByParent(context.env.DB, user) }, 200);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const settings = validateEmailAlertSettings(body);
  if ("error" in settings) return json(settings, 400);
  const quiet = quietHoursToRow(settings);

  await context.env.DB
    .prepare(
      `INSERT INTO notification_settings (user_id, email, email_addr, due_1day, due_today, makeup, payout, quiet_start, quiet_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         email = excluded.email, email_addr = excluded.email_addr, due_1day = excluded.due_1day,
         due_today = excluded.due_today, makeup = excluded.makeup, payout = excluded.payout,
         quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end`,
    )
    .bind(
      user.id,
      settings.email ? 1 : 0,
      settings.emailAddr || null,
      settings.due1day ? 1 : 0,
      settings.dueToday ? 1 : 0,
      settings.makeup ? 1 : 0,
      settings.payout ? 1 : 0,
      quiet.quiet_start,
      quiet.quiet_end,
    )
    .run();

  return json({ ...settings, allowedByParent: await allowedByParent(context.env.DB, user) }, 200);
};
