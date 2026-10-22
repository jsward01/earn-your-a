import type { Env } from "../../../_lib/env";
import { getSessionUser } from "../../../_lib/session";
import { cleanChecked, getOwnPlan, toPlanJson } from "../../../_lib/aiPlans";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Save which steps are checked off: `{ checked: number[] }`. */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "student") return json({ error: "Only the student can change their plans" }, 403);

  const row = await getOwnPlan(db, String(context.params.id), user.id);
  if (!row) return json({ error: "Not found" }, 404);

  let body: { checked?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const steps = (JSON.parse(row.plan) as { steps: unknown[] }).steps.length;
  const checked = cleanChecked(body.checked, steps);
  if (!checked) return json({ error: "checked must be a list of step numbers" }, 400);

  const checkedJson = JSON.stringify(checked);
  await db.prepare("UPDATE ai_plans SET checked = ?, updated_at = datetime('now') WHERE id = ?").bind(checkedJson, row.id).run();
  return json(toPlanJson({ ...row, checked: checkedJson }), 200);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "student") return json({ error: "Only the student can delete their plans" }, 403);

  const row = await getOwnPlan(db, String(context.params.id), user.id);
  if (!row) return json({ error: "Not found" }, 404);
  await db.prepare("DELETE FROM ai_plans WHERE id = ?").bind(row.id).run();
  return json({ ok: true }, 200);
};
