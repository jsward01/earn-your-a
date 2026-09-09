import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";

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
  const details = body.details?.trim() || "None";
  const today = new Date().toISOString().split("T")[0];

  const client = new Anthropic({ apiKey: context.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: { effort: "medium", format: zodOutputFormat(PlanSchema) },
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
    });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    const requestId = err instanceof Anthropic.APIError ? err.requestID : undefined;
    const rawError = err instanceof Anthropic.APIError ? err.error : undefined;
    console.error("AI assignment plan request failed", {
      status,
      requestId,
      rawError,
      keyPrefix: context.env.ANTHROPIC_API_KEY?.slice(0, 12),
      keyLength: context.env.ANTHROPIC_API_KEY?.length,
      message: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "Couldn't generate plan. Please try again." }, 502);
  }

  if (!response.parsed_output) {
    return json({ error: "Couldn't generate plan. Please try again." }, 502);
  }

  return json(response.parsed_output, 200);
};
