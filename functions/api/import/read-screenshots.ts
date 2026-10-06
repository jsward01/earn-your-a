import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const MAX_IMAGES = 8;
/** The browser shrinks screenshots before upload; this only stops something unreasonable (~5 MB per image). */
const MAX_BASE64_CHARS = 7_000_000;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"] as const);
type MediaType = "image/jpeg" | "image/png" | "image/webp";

interface RequestBody {
  images?: { mediaType?: string; data?: string }[];
}

const PROMPT = `These are screenshots of a school portal's notification list (for example Infinite Campus). Transcribe every notification you can read in full.

Rules:
- One notification per line, in the order shown (top to bottom; if there are several screenshots, go through them in order).
- Copy the notification text exactly as written — names, numbers, class names, punctuation. If its text wraps onto several lines in the screenshot, join it into one line.
- If a date or time is shown with the notification (e.g. "Today, 11:01 AM"), add " | " and then that stamp exactly as shown.
- Skip a notification that is cut off at the top or bottom edge so that part of its text is missing.
- Leave out everything else: headings, buttons, menus, and page content behind the panel.
- Output only the lines. No commentary, no numbering, no blank lines. If there are no notifications, output nothing.`;

/**
 * Parent-only: read notification screenshots into plain text lines, which the browser then parses and shows on the
 * normal import checklist. Nothing is saved here and the images are not stored.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can import grades" }, 403);

  let body: RequestBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const images = body.images ?? [];
  if (!Array.isArray(images) || images.length === 0) return json({ error: "Add at least one screenshot" }, 400);
  if (images.length > MAX_IMAGES) return json({ error: `At most ${MAX_IMAGES} screenshots at a time` }, 400);
  for (const img of images) {
    if (!img || !MEDIA_TYPES.has(img.mediaType as MediaType)) return json({ error: "Screenshots must be JPEG, PNG or WebP" }, 400);
    if (typeof img.data !== "string" || !img.data || img.data.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/]+=*$/.test(img.data)) {
      return json({ error: "One of the screenshots couldn't be read — try a smaller image" }, 400);
    }
  }

  const client = new Anthropic({ apiKey: context.env.ANTHROPIC_API_KEY });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((img): Anthropic.Beta.BetaContentBlockParam => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType as MediaType, data: img.data as string },
    })),
    { type: "text", text: PROMPT },
  ];

  let response;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // On a safety decline, the API retries on a fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Too many requests right now — try again in a minute" }, 429);
    if (err instanceof Anthropic.BadRequestError) {
      console.error("Screenshot read rejected", err.message);
      return json({ error: "Those images couldn't be read — try fewer or smaller screenshots" }, 400);
    }
    console.error("Screenshot read failed", err);
    return json({ error: "Couldn't read the screenshots. Please try again." }, 502);
  }

  if (response.stop_reason === "refusal") return json({ error: "The screenshots couldn't be read. Try cropping to just the notification list." }, 502);

  const text = response.content
    .flatMap(b => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .join("\n");

  return json({ text, truncated: response.stop_reason === "max_tokens" }, 200);
};
