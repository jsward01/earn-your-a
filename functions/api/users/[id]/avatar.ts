import type { Env } from "../../../_lib/env";
import { getSessionUser } from "../../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// A client-resized 128px avatar is ~10-20 KB (~15-27K chars of base64); this is generous headroom, not a target.
const MAX_UPLOAD_CHARS = 100_000;
const PRESET = /^preset:[a-z0-9-]{1,40}$/;
// Raster types only: an <img> never runs script from these, unlike SVG.
const UPLOAD = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function isValidAvatar(value: string): boolean {
  if (PRESET.test(value)) return true;
  return value.length <= MAX_UPLOAD_CHARS && UPLOAD.test(value);
}

interface PutBody {
  avatar?: string | null;
}

/**
 * Student-only: set (or clear, with `null`) your own profile picture. It was parent-only until Oct 21, 2026, when
 * Jonathan moved it to the student ("this should be done by the student and not the parent").
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "student") return json({ error: "Students choose their own profile picture" }, 403);

  const id = String(context.params.id);
  if (id !== user.id) return json({ error: "You can only change your own picture" }, 403);

  let body: PutBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  // Clearing must be explicit (`{"avatar": null}`), never the result of a missing field.
  if (!body || typeof body !== "object" || !("avatar" in body)) return json({ error: "avatar is required (use null to clear)" }, 400);
  const avatar = body.avatar ?? null;
  if (avatar !== null && (typeof avatar !== "string" || !isValidAvatar(avatar))) {
    return json({ error: "Invalid avatar" }, 400);
  }

  await context.env.DB.prepare("UPDATE users SET avatar = ? WHERE id = ?").bind(avatar, id).run();
  return json({ userId: id, avatar }, 200);
};
