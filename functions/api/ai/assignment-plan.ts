import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { aiLimitMessage, claimAiUse } from "../../_lib/aiUsage";
import { toPlanJson, type AiPlanRow } from "../../_lib/aiPlans";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const PlanSchema = z.object({
  summary: z.string(),
  estimatedHours: z.number(),
  steps: z.array(
    z.object({
      day: z.string(),
      task: z.string(),
      duration: z.string(),
      tip: z.string().optional(),
    }),
  ),
});

interface RequestBody {
  title?: string;
  subject?: string;
  type?: string;
  dueDate?: string;
  details?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "student") return json({ error: "Only the student can generate an assignment plan" }, 403);

  let body: RequestBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const title = body.title?.trim();
  const subject = body.subject?.trim();
  const type = body.type?.trim();
  const dueDate = body.dueDate?.trim();
  if (!title || !subject || !type || !dueDate) {
    return json({ error: "title, subject, type, and dueDate are required" }, 400);
  }
  const detailsText = body.details?.trim() ?? "";
  const details = detailsText || "None";
  const today = new Date().toISOString().split("T")[0];

  const claim = await claimAiUse(context.env.DB, user.familyId, "plan");
  if (!claim.ok) return json({ error: aiLimitMessage("plan", claim.limit) }, 429);
  // Anything but a usable plan hands the use back, so a failed attempt doesn't count against the family.
  const fail = async (error: string, status: number) => {
    await claim.release();
    return json({ error }, status);
  };

  const client = new Anthropic({ apiKey: context.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.beta.messages
      .stream({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
        // On a safety decline, the API retries on a fallback model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [
          {
            role: "user",
            content: `You are an academic coach helping a high school student break down a big assignment into a manageable step-by-step plan.

Assignment: "${title}"
Subject: ${subject}
Type: ${type}
Due Date: ${dueDate}
Today's Date: ${today}
Extra details: ${details}

Create a realistic day-by-day action plan to complete this assignment successfully.`,
          },
        ],
      })
      .finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return fail("Too many requests right now — try again in a minute", 429);
    console.error("AI assignment plan request failed", err);
    return fail("Couldn't generate plan. Please try again.", 502);
  }

  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    return fail("Couldn't generate plan. Please try again.", 502);
  }

  // Saved so it survives a refresh and shows on her other devices.
  const row: AiPlanRow = {
    id: crypto.randomUUID(),
    family_id: user.familyId,
    student_id: user.id,
    title,
    subject,
    type,
    due_date: dueDate,
    details: detailsText,
    plan: JSON.stringify(response.parsed_output),
    checked: "[]",
    created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
  await context.env.DB
    .prepare(
      `INSERT INTO ai_plans (id, family_id, student_id, title, subject, type, due_date, details, plan, checked, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.family_id, row.student_id, row.title, row.subject, row.type, row.due_date, row.details, row.plan, row.checked, row.created_at)
    .run();

  return json(toPlanJson(row), 200);
};
