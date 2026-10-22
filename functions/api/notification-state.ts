import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const MAX_IDS = 500;
const ID = /^[A-Za-z0-9:_-]{1,100}$/;
/** Rows untouched this long are dropped: the alerts they name (due dates, retake windows, a week's summary) are long gone. */
const KEEP = "-90 days";

/** The signed-in person's read and dismissed alerts (their own, whichever student a parent is looking at). */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  const { results } = await context.env.DB
    .prepare("SELECT notification_id, state FROM notification_reads WHERE user_id = ?")
    .bind(user.id)
    .all<{ notification_id: string; state: string }>();
  return json(
    {
      read: results.filter(r => r.state === "read").map(r => r.notification_id),
      dismissed: results.filter(r => r.state === "dismissed").map(r => r.notification_id),
    },
    200,
  );
};

/** Mark alerts read or dismissed: `{ ids: string[], state: "read" | "dismissed" }`. Read never undoes a dismiss. */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  let body: { ids?: unknown; state?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const { ids, state } = body;
  if (state !== "read" && state !== "dismissed") return json({ error: "state must be read or dismissed" }, 400);
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS || !ids.every(id => typeof id === "string" && ID.test(id))) {
    return json({ error: "ids must be a list of alert ids" }, 400);
  }

  const upsert = db.prepare(
    `INSERT INTO notification_reads (user_id, notification_id, state) VALUES (?, ?, ?)
     ON CONFLICT (user_id, notification_id) DO UPDATE SET
       state = CASE WHEN notification_reads.state = 'dismissed' THEN 'dismissed' ELSE excluded.state END,
       updated_at = datetime('now')`,
  );
  await db.batch([
    ...[...new Set(ids as string[])].map(id => upsert.bind(user.id, id, state)),
    db.prepare("DELETE FROM notification_reads WHERE user_id = ? AND updated_at < datetime('now', ?)").bind(user.id, KEEP),
  ]);
  return json({ ok: true }, 200);
};
