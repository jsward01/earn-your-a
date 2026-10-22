import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { isAccent } from "../../_lib/accent";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Set your own accent color (`{ accent: "pink" }`), or go back to your role's default with `{ accent: null }`. */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);

  let body: { accent?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!body || typeof body !== "object" || !("accent" in body)) return json({ error: "accent is required (use null for the default)" }, 400);
  const accent = body.accent ?? null;
  if (accent !== null && !isAccent(accent)) return json({ error: "Unknown color" }, 400);

  await context.env.DB.prepare("UPDATE users SET accent = ? WHERE id = ?").bind(accent, user.id).run();
  return json({ accent }, 200);
};
