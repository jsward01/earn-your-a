import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Show or hide the Class Averages / Progress cards on your own Home page (`{ classAverages?: boolean, progress?: boolean }`).
 * Students only (parents have no Home page); a field left out keeps its saved value.
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "student") return json({ error: "Only students have a Home page" }, 403);

  let body: { classAverages?: unknown; progress?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid request body" }, 400);
  const { classAverages, progress } = body;
  if (classAverages === undefined && progress === undefined) return json({ error: "classAverages or progress is required" }, 400);
  if ((classAverages !== undefined && typeof classAverages !== "boolean") || (progress !== undefined && typeof progress !== "boolean")) {
    return json({ error: "classAverages and progress must be true or false" }, 400);
  }

  const showClassAverages = classAverages ?? user.showClassAverages;
  const showProgress = progress ?? user.showProgress;
  await context.env.DB.prepare("UPDATE users SET show_class_averages = ?, show_progress = ? WHERE id = ?")
    .bind(showClassAverages ? 1 : 0, showProgress ? 1 : 0, user.id).run();
  return json({ showClassAverages, showProgress }, 200);
};
