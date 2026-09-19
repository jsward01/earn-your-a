import type { Env } from "../_lib/env";
import { getSessionUser } from "../_lib/session";
import { resolveStudentId } from "../_lib/students";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface HistoryRow {
  id: string;
  assignment_id: string;
  action: "create" | "update" | "delete";
  summary: string;
  ledger_before: number | null;
  ledger_after: number | null;
  created_at: string;
  actor_name: string;
  actor_role: "parent" | "student";
}

/** Parent-only change log for one student: everything, or one assignment with `?assignmentId=`. */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can view change history" }, 403);

  const resolved = await resolveStudentId(context.env.DB, user, context.request);
  if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

  const params = new URL(context.request.url).searchParams;
  const assignmentId = params.get("assignmentId");
  const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "30", 10) || 30, 1), 100);

  const { results } = await context.env.DB
    .prepare(
      `SELECT h.id, h.assignment_id, h.action, h.summary, h.ledger_before, h.ledger_after, h.created_at,
              u.name AS actor_name, u.role AS actor_role
       FROM assignment_history h JOIN users u ON u.id = h.actor_id
       WHERE h.family_id = ? AND h.student_id = ? ${assignmentId ? "AND h.assignment_id = ?" : ""}
       ORDER BY h.created_at DESC, h.rowid DESC LIMIT ?`,
    )
    .bind(...[user.familyId, resolved.studentId, ...(assignmentId ? [assignmentId] : []), limit])
    .all<HistoryRow>();

  return json(
    results.map(r => ({
      id: r.id,
      assignmentId: r.assignment_id,
      action: r.action,
      summary: r.summary,
      ledgerBefore: r.ledger_before,
      ledgerAfter: r.ledger_after,
      createdAt: r.created_at,
      actorName: r.actor_name,
      actorRole: r.actor_role,
    })),
    200,
  );
};
