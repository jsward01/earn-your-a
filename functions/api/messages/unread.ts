import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { resolveThread } from "../../_lib/messages";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * For the Messages tab badge: how many messages from other people the caller hasn't seen in this conversation, and
 * whether messaging is on (a student whose messaging is off gets `allowed: false`, so the app hides the tab).
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  const thread = await resolveThread(db, user, context.request);
  if ("error" in thread) {
    if (thread.status === 403 && user.role === "student") return json({ allowed: false, count: 0 }, 200);
    return json({ error: thread.error }, thread.status);
  }

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM messages m
       WHERE m.student_id = ? AND m.sender_id != ?
         AND m.rowid > COALESCE((SELECT read_rowid FROM message_reads WHERE user_id = ? AND student_id = ?), 0)`,
    )
    .bind(thread.studentId, user.id, user.id, thread.studentId)
    .first<{ count: number }>();
  return json({ allowed: thread.allowed, count: row?.count ?? 0 }, 200);
};
