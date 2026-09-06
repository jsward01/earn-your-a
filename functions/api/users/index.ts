import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface UserRow {
  id: string;
  name: string;
  role: "parent" | "student";
  email: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can view account access" }, 403);

  const { results } = await context.env.DB
    .prepare("SELECT id, name, role, email FROM users WHERE family_id = ? ORDER BY role DESC")
    .bind(user.familyId)
    .all<UserRow>();

  return json(results, 200);
};
