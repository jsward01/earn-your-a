import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { MESSAGE_PAGE, markReadStatement, resolveThread, toMessageJson, validateMessageBody, type MessageRow } from "../../_lib/messages";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const SELECT_MESSAGES = `SELECT m.rowid AS seq, m.id, m.sender_id, u.name AS sender_name, u.role AS sender_role, m.body, m.created_at
  FROM messages m JOIN users u ON u.id = m.sender_id`;

/**
 * The family chat with one student: the student and all of the family's parents (one conversation per student).
 * Reading it marks it read for the caller. Returns the latest messages oldest-first, who's in the chat, and whether
 * messaging is on (a parent still sees the history when a student's messaging is off, but can't post).
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  const thread = await resolveThread(db, user, context.request);
  if ("error" in thread) return json({ error: thread.error }, thread.status);

  const { results } = await db
    .prepare(`${SELECT_MESSAGES} WHERE m.student_id = ? ORDER BY m.rowid DESC LIMIT ?`)
    .bind(thread.studentId, MESSAGE_PAGE)
    .all<MessageRow>();
  const messages = results.reverse();
  const { results: members } = await db
    .prepare("SELECT id, name, role FROM users WHERE family_id = ? AND (role = 'parent' OR id = ?) ORDER BY role DESC, created_at, id")
    .bind(user.familyId, thread.studentId)
    .all<{ id: string; name: string; role: "parent" | "student" }>();

  const last = messages.at(-1)?.seq;
  if (last) await markReadStatement(db, user.id, thread.studentId, last).run();

  return json({ allowed: thread.allowed, members, messages: messages.map(toMessageJson) }, 200);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  const thread = await resolveThread(db, user, context.request);
  if ("error" in thread) return json({ error: thread.error }, thread.status);
  if (!thread.allowed) return json({ error: "Messaging is turned off for this student. Turn it on in Settings → Family." }, 403);

  let body: { body?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const checked = validateMessageBody(body.body);
  if ("error" in checked) return json(checked, 400);

  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO messages (id, family_id, student_id, sender_id, body) VALUES (?, ?, ?, ?, ?)")
    .bind(id, user.familyId, thread.studentId, user.id, checked.body)
    .run();
  const row = await db.prepare(`${SELECT_MESSAGES} WHERE m.id = ?`).bind(id).first<MessageRow>();
  // Your own message never counts as unread for you.
  await markReadStatement(db, user.id, thread.studentId, row!.seq).run();
  return json(toMessageJson(row!), 200);
};
