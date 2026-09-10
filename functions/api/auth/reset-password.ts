import type { Env } from "../../_lib/env";
import { generateTempPassword, hashPassword } from "../../_lib/password";
import { getSessionUser } from "../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface ResetBody {
  userId?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionUser = await getSessionUser(context.env.DB, context.request);
  if (!sessionUser) return json({ error: "Not authenticated" }, 401);
  if (sessionUser.role !== "parent") return json({ error: "Only a parent can reset a password" }, 403);

  let body: ResetBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const userId = body.userId;
  if (!userId) return json({ error: "userId is required" }, 400);

  const target = await context.env.DB
    .prepare("SELECT id, name, email, role FROM users WHERE id = ? AND family_id = ?")
    .bind(userId, sessionUser.familyId)
    .first<{ id: string; name: string; email: string; role: "parent" | "student" }>();
  if (!target) return json({ error: "Not found" }, 404);
  if (target.role === "parent" && !sessionUser.isAdmin) {
    return json({ error: "Only the family admin can reset another parent's password" }, 403);
  }

  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);

  await context.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, target.id).run();
  // Reset invalidates any sessions the account already had, forcing a fresh login with the new password.
  await context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id).run();

  return json({ userId: target.id, name: target.name, email: target.email, password: tempPassword }, 200);
};
