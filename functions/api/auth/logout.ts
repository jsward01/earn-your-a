import type { Env } from "../../_lib/env";
import { parseSessionCookie, deleteSession, clearSessionCookieHeader } from "../../_lib/session";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionId = parseSessionCookie(context.request);
  if (sessionId) {
    await deleteSession(context.env.DB, sessionId);
  }
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookieHeader() } });
};
