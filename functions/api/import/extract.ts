import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { validateImages } from "../../_lib/images";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** A pasted page can be long (a full year of assignments is ~20 KB); this only stops something unreasonable. */
const MAX_TEXT = 200_000;

// What we ask Claude for: one entry per assignment, in a shape the browser turns into the normal import checklist
// (src/lib/import/other.ts). Keep in sync with `ExtractedItem` in src/lib/import/types.ts.
const ExtractSchema = z.object({
  items: z.array(
    z.object({
      className: z.string(),
      title: z.string(),
      status: z.enum(["graded", "missing", "pending", "dropped", "exempt"]),
      pointsEarned: z.number().nullable(),
      pointsPossible: z.number().nullable(),
      percent: z.number().nullable(),
      dueDate: z.string().nullable(),
      flags: z.array(z.string()),
    }),
  ),
});

const PROMPT = (today: string) => `Below is grade information a parent copied or screenshotted from their child's school portal or class app (PowerSchool, Skyward, Synergy/ParentVUE, Aeries, Canvas, Schoology, Google Classroom, or similar). Extract every individual assignment, quiz, test or other graded item.

For each item:
- className: the class/course name as shown (keep any term suffix like "-S1"; if the page is for one class only, use that class's name from the page).
- title: the assignment name exactly as shown.
- status: "graded" if it has a score; "missing" if marked missing (even if a 0 is shown); "dropped" or "exempt" if marked so; "pending" if it is listed with no score yet.
- pointsEarned / pointsPossible: the score in points when shown (e.g. 8 / 10, 13.5/15), else null.
- percent: the percentage when shown (or the only score shown), else null. Do not convert letter grades — leave both null if only a letter is shown.
- dueDate: the due date as YYYY-MM-DD, else null. Today is ${today}; resolve "Today", "Yesterday", weekday names, and dates without a year relative to it.
- flags: other markers shown for the item, lowercase, e.g. "late", "incomplete", "collected". Leave out "missing", "dropped" and "exempt" (they go in status).

Skip anything that is not a single assignment: class/semester/term averages, category totals, attendance, announcements, and page navigation. Never invent items or numbers; if a value isn't shown, use null. If the same assignment appears more than once, include it once with the most recent information.`;

/**
 * Parent-only: turn pasted text and/or screenshots from ANY school system into a list of assignments. The browser
 * then matches them and shows the usual review checklist; nothing is saved here and images are not stored.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can import grades" }, 403);

  let body: { text?: unknown; images?: unknown; today?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length > MAX_TEXT) return json({ error: "That's too much text at once — paste one term or a few classes at a time" }, 400);
  const checked = validateImages(body.images, false);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const { images } = checked;
  if (!text && images.length === 0) return json({ error: "Paste some text or add a screenshot" }, 400);
  const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((img): Anthropic.Beta.BetaContentBlockParam => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } })),
    { type: "text", text: PROMPT(today) + (text ? `\n\n<pasted>\n${text}\n</pasted>` : "") },
  ];

  const client = new Anthropic({ apiKey: context.env.ANTHROPIC_API_KEY });
  let response;
  try {
    // Streamed so a long list (many thousands of output tokens) can't hit an HTTP timeout.
    response = await client.beta.messages
      .stream({
        model: "claude-opus-5-5",
        max_tokens: 64000,
        output_config: { effort: "medium", format: betaZodOutputFormat(ExtractSchema) },
        // On a safety decline, the API retries on a fallback model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content }],
      })
      .finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Too many requests right now — try again in a minute" }, 429);
    if (err instanceof Anthropic.BadRequestError) {
      console.error("Grade extract rejected", err.message);
      return json({ error: "That couldn't be read — try less text or fewer/smaller screenshots" }, 400);
    }
    console.error("Grade extract failed", err);
    return json({ error: "Couldn't read that. Please try again." }, 502);
  }

  if (response.stop_reason === "refusal") return json({ error: "That couldn't be read. Try pasting just the assignments list." }, 502);
  if (response.stop_reason === "max_tokens") return json({ error: "That list is too long to read at once — paste one term or a few classes at a time" }, 400);
  const parsed = response.parsed_output;
  if (!parsed) return json({ error: "Couldn't read that. Please try again." }, 502);

  return json({ items: parsed.items }, 200);
};
