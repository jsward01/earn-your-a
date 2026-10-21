import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { resolveStudentId } from "../../_lib/students";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Parent-only: show (default) or hide this student's Track only work in the Overview's To Grade / Coming Up /
 * Missing / Low Grade lists (`users.track_only_alerts`). Class averages always include it.
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can manage classes" }, 403);
  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  let body: { show?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (typeof body.show !== "boolean") return json({ error: "show must be true or false" }, 400);

  await context.env.DB.prepare("UPDATE users SET track_only_alerts = ? WHERE id = ?").bind(body.show ? 1 : 0, resolved.studentId).run();
  return json({ showTrackOnlyAlerts: body.show }, 200);
};
