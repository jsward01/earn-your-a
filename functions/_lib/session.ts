const SESSION_COOKIE = "session";
const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  familyId: string;
  role: "parent" | "student";
  name: string;
  email: string;
}

export async function createSession(db: D1Database, userId: string): Promise<{ id: string; expiresAt: string }> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(id, userId, expiresAt).run();
  return { id, expiresAt };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function parseSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(sessionId: string, expiresAt: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

interface SessionRow {
  id: string;
  family_id: string;
  role: "parent" | "student";
  name: string;
  email: string;
}

export async function getSessionUser(db: D1Database, request: Request): Promise<SessionUser | null> {
  const sessionId = parseSessionCookie(request);
  if (!sessionId) return null;

  const row = await db
    .prepare(
      `SELECT u.id, u.family_id, u.role, u.name, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
    .bind(sessionId)
    .first<SessionRow>();

  if (!row) return null;
  return { id: row.id, familyId: row.family_id, role: row.role, name: row.name, email: row.email };
}
