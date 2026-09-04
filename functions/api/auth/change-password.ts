import type { Env } from "../../_lib/env";
import { hashPassword, verifyPassword } from "../../_lib/password";
import { getSessionUser } from "../../_lib/session";

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionUser = await getSessionUser(context.env.DB, context.request);
  if (!sessionUser) {
    return json({ error: "Not authenticated" }, 401);
  }

  let body: ChangePasswordBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return json({ error: "Current and new password are required" }, 400);
  }
  if (newPassword.length < 8) {
    return json({ error: "New password must be at least 8 characters" }, 400);
  }

  const row = await context.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(sessionUser.id)
    .first<{ password_hash: string }>();

  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
    return json({ error: "Current password is incorrect" }, 401);
  }

  const newHash = await hashPassword(newPassword);
  await context.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newHash, sessionUser.id).run();

  return json({ ok: true }, 200);
};
