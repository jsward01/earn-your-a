import type { SessionUser } from "./session";
import { resolveStudentId } from "./students";

/** Longest message accepted, in characters. */
export const MAX_MESSAGE_LENGTH = 2000;

/** How many of the latest messages the Messages screen loads. */
export const MESSAGE_PAGE = 200;

/** The trimmed text to save, or an error for the sender. */
export function validateMessageBody(value: unknown): { body: string } | { error: string } {
  if (typeof value !== "string") return { error: "Type a message first" };
  const body = value.trim();
  if (!body) return { error: "Type a message first" };
  if (body.length > MAX_MESSAGE_LENGTH) return { error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters` };
  return { body };
}

export type Thread = { studentId: string; allowed: boolean } | { error: string; status: number };

/**
 * The conversation a request is about: the student's own for a student, the selected student (`?studentId=`) for a
 * parent. `allowed` is the parent switch; a student whose messaging is off gets a 403 instead.
 */
export async function resolveThread(db: D1Database, user: SessionUser, request: Request): Promise<Thread> {
  const resolved = await resolveStudentId(db, user, request);
  if ("error" in resolved) return resolved;
  const row = await db.prepare("SELECT messaging_allowed FROM users WHERE id = ?").bind(resolved.studentId).first<{ messaging_allowed: number }>();
  const allowed = row?.messaging_allowed !== 0;
  if (!allowed && user.role === "student") return { error: "Messaging is turned off. Ask a parent if you need it back.", status: 403 };
  return { studentId: resolved.studentId, allowed };
}

/** Move a person's "seen up to" mark forward (never back). */
export function markReadStatement(db: D1Database, userId: string, studentId: string, rowid: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO message_reads (user_id, student_id, read_rowid) VALUES (?, ?, ?)
       ON CONFLICT (user_id, student_id) DO UPDATE SET read_rowid = MAX(read_rowid, excluded.read_rowid)`,
    )
    .bind(userId, studentId, rowid);
}

export interface MessageRow {
  seq: number;
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: "parent" | "student";
  body: string;
  created_at: string;
}

export function toMessageJson(r: MessageRow) {
  return { seq: r.seq, id: r.id, senderId: r.sender_id, senderName: r.sender_name, senderRole: r.sender_role, body: r.body, createdAt: r.created_at };
}
