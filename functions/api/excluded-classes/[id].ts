import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Parent-only: include a class in imports again (its work is offered as new on the next import). */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can manage imports" }, 403);

  const result = await context.env.DB
    .prepare("DELETE FROM excluded_classes WHERE id = ? AND family_id = ?")
    .bind(String(context.params.id), user.familyId)
    .run();
  if (result.meta.changes === 0) return json({ error: "Not found" }, 404);
  return json({ ok: true }, 200);
};
