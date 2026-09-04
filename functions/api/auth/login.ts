import type { Env } from "../../_lib/env";
import { verifyPassword } from "../../_lib/password";
import { createSession, sessionCookieHeader } from "../../_lib/session";

interface LoginBody {
  email?: string;
  password?: string;
}

interface UserRow {
  id: string;
  family_id: string;
  role: string;
  name: string;
  email: string;
  password_hash: string;
}

function json(data: unknown, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: LoginBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return json({ error: "Email and password are required" }, 400);
  }

  const user = await context.env.DB.prepare(
    "SELECT id, family_id, role, name, email, password_hash FROM users WHERE email = ?",
  )
    .bind(email)
    .first<UserRow>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: "Invalid email or password" }, 401);
  }

  const session = await createSession(context.env.DB, user.id);

  return json(
    { id: user.id, familyId: user.family_id, role: user.role, name: user.name, email: user.email },
    200,
    { "Set-Cookie": sessionCookieHeader(session.id, session.expiresAt) },
  );
};
