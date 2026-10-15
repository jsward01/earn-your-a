import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { getAssignmentRow } from "../../_lib/assignments";
import { deleteAssignmentWithHistory } from "../../_lib/history";
import { getBalance } from "../../_lib/rewards";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const MAX_IDS = 200;

/**
 * Parent-only: delete several assignments at once (each one exactly like a single delete, history included).
 * Paid-out work is archived and is skipped, not deleted; anything not in the parent's family is skipped as not found.
 * Returns what was deleted and skipped, plus the balance afterward (for the selected work's student).
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const user = await getSessionUser(db, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can delete several items at once" }, 403);

  let body: { ids?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === "string" && x.length > 0))] : [];
  if (ids.length === 0) return json({ error: "ids must be a non-empty list" }, 400);
  if (ids.length > MAX_IDS) return json({ error: `At most ${MAX_IDS} at a time` }, 400);

  const deleted: string[] = [];
  const skipped: { id: string; reason: "not_found" | "paid_out" }[] = [];
  let studentId: string | null = null;
  for (const id of ids) {
    const existing = await getAssignmentRow(db, id);
    if (!existing || existing.family_id !== user.familyId) {
      skipped.push({ id, reason: "not_found" });
      continue;
    }
    if (existing.payout_id) {
      skipped.push({ id, reason: "paid_out" });
      continue;
    }
    await deleteAssignmentWithHistory(db, existing, user.familyId, user.id);
    deleted.push(id);
    studentId = existing.student_id;
  }

  const balance = studentId ? await getBalance(db, studentId) : null;
  return json({ deleted, skipped, balance }, 200);
};
