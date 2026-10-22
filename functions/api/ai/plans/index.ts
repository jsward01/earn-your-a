import type { Env } from "../../../_lib/env";
import { getSessionUser } from "../../../_lib/session";
import { toPlanJson, type AiPlanRow } from "../../../_lib/aiPlans";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** The signed-in student's saved AI Planner plans, newest first. Plans are private to the student. */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "student") return json({ error: "Only the student can see their plans" }, 403);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM ai_plans WHERE student_id = ? ORDER BY created_at DESC, rowid DESC")
    .bind(user.id)
    .all<AiPlanRow>();
  return json(results.map(toPlanJson), 200);
};
