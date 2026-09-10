import type { Env } from "../../_lib/env";
import { generateTempPassword, hashPassword } from "../../_lib/password";
import { getSessionUser } from "../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface UserRow {
  id: string;
  name: string;
  role: "parent" | "student";
  email: string;
  is_admin: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can view account access" }, 403);

  const { results } = await context.env.DB
    .prepare("SELECT id, name, role, email, is_admin FROM users WHERE family_id = ? ORDER BY role DESC")
    .bind(user.familyId)
    .all<UserRow>();

  return json(
    results.map(r => ({ id: r.id, name: r.name, role: r.role, email: r.email, isAdmin: !!r.is_admin })),
    200,
  );
};

interface AddParentBody {
  name?: string;
  email?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent" || !user.isAdmin) {
    return json({ error: "Only the family admin can add a parent account" }, 403);
  }

  let body: AddParentBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!name || !email) return json({ error: "Name and email are required" }, 400);

  const existing = await context.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "That email is already in use" }, 409);

  const id = crypto.randomUUID();
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await context.env.DB.prepare(
    "INSERT INTO users (id, family_id, role, name, email, password_hash, is_admin) VALUES (?, ?, 'parent', ?, ?, ?, 0)",
  )
    .bind(id, user.familyId, name, email, passwordHash)
    .run();

  return json({ userId: id, name, email, password: tempPassword }, 200);
};
