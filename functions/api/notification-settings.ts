import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";
import {
  defaultEmailAlertSettings,
  fromRow,
  validateEmailAlertSettings,
  type NotificationSettingsRow,
} from "../_lib/notificationSettings";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// Settings belong to the signed-in user (parent or student), never to a ?studentId= —
// a parent can't read or change their student's email address from here.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  const row = await context.env.DB
    .prepare("SELECT email, email_addr, due_1day, due_today, makeup, payout FROM notification_settings WHERE user_id = ?")
    .bind(user.id)
    .first<NotificationSettingsRow>();

  return json(row ? fromRow(row) : defaultEmailAlertSettings(user.email), 200);
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

  await context.env.DB
    .prepare(
      `INSERT INTO notification_settings (user_id, email, email_addr, due_1day, due_today, makeup, payout)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         email = excluded.email, email_addr = excluded.email_addr, due_1day = excluded.due_1day,
         due_today = excluded.due_today, makeup = excluded.makeup, payout = excluded.payout`,
    )
    .bind(
      user.id,
      settings.email ? 1 : 0,
      settings.emailAddr || null,
      settings.due1day ? 1 : 0,
      settings.dueToday ? 1 : 0,
      settings.makeup ? 1 : 0,
      settings.payout ? 1 : 0,
    )
    .run();

  return json(settings, 200);
};
