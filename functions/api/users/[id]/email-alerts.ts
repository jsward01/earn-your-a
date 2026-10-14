import type { Env } from "../../../_lib/env";
import { getSessionUser } from "../../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Parent-only: allow or stop alert emails to a student (`users.email_alerts_allowed`). Off overrides whatever the student
 * chose in their own Alerts settings; their choices are kept, so turning it back on restores them. Parents' own alerts
 * about the student are not affected.
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

  await context.env.DB.prepare("UPDATE users SET email_alerts_allowed = ? WHERE id = ?").bind(body.allowed ? 1 : 0, id).run();
  return json({ emailAlertsAllowed: body.allowed }, 200);
};
