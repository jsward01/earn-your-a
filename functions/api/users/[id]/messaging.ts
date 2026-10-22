import type { Env } from "../../../_lib/env";
import { getSessionUser } from "../../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Parent-only: turn messaging on or off for a student (`users.messaging_allowed`). Off hides the student's Messages tab
 * and stops anyone posting to that conversation; the history is kept, so turning it back on brings it all back.
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can change this" }, 403);

  const id = String(context.params.id);
  const target = await context.env.DB
    .prepare("SELECT id FROM users WHERE id = ? AND family_id = ? AND role = 'student'")
    .bind(id, user.familyId)
    .first<{ id: string }>();
  if (!target) return json({ error: "Student not found" }, 404);

  let body: { allowed?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (typeof body.allowed !== "boolean") return json({ error: "allowed must be true or false" }, 400);

  await context.env.DB.prepare("UPDATE users SET messaging_allowed = ? WHERE id = ?").bind(body.allowed ? 1 : 0, id).run();
  return json({ messagingAllowed: body.allowed }, 200);
};
