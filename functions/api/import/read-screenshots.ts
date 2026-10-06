import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { validateImages } from "../../_lib/images";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface RequestBody {
  images?: unknown;
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

  const checked = validateImages(body.images, true);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const { images } = checked;

  const client = new Anthropic({ apiKey: context.env.ANTHROPIC_API_KEY });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((img): Anthropic.Beta.BetaContentBlockParam => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.data },
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
