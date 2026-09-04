import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(user), { status: 200, headers: { "Content-Type": "application/json" } });
};
