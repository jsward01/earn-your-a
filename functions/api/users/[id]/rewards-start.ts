import type { Env } from "../../../_lib/env";
import { getSessionUser } from "../../../_lib/session";
import { isIsoDate } from "../../../_lib/assignmentEdits";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Parent-only: set when rewards start for a student. Work created afterwards with a due date before this is saved as
 * history (recorded, $0). Existing work keeps whatever it was created as — changing the date never re-prices anything.
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can set when rewards start" }, 403);

  const id = String(context.params.id);
  const target = await context.env.DB
    .prepare("SELECT id FROM users WHERE id = ? AND family_id = ? AND role = 'student'")
    .bind(id, user.familyId)
    .first<{ id: string }>();
  if (!target) return json({ error: "Student not found" }, 404);

  let body: { date?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const date = body.date;
  // Shape plus a real calendar day (isIsoDate alone would accept 2026-02-30).
  const ms = typeof date === "string" && isIsoDate(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  if (typeof date !== "string" || Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    return json({ error: "date must be a real date, YYYY-MM-DD" }, 400);
  }
  // A little slack for time zones: "today" in the parent's browser can be tomorrow in UTC.
  const latest = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
  if (date > latest) return json({ error: "The start date can't be in the future" }, 400);

  await context.env.DB.prepare("UPDATE users SET rewards_start_date = ? WHERE id = ?").bind(date, id).run();
  return json({ rewardsStartDate: date }, 200);
};
