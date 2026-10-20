import type { Env } from "../../_lib/env";
import { getSessionUser } from "../../_lib/session";
import { getFullRewardSettings } from "../../_lib/rewards";
import { loadRepriceAssignments, planReprice, repriceStatements, summarizeReprice } from "../../_lib/reprice";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * What "Recalculate all graded work at today's rates" would do, per student, plus each balance before and after.
 * The same numbers are computed again on POST, so the pop-up can never apply something other than what it read.
 */
async function preview(db: D1Database, familyId: string) {
  const settings = await getFullRewardSettings(db, familyId);
  const changes = planReprice(await loadRepriceAssignments(db, familyId), settings);
  const { results: students } = await db
    .prepare(
      `SELECT u.id, u.name, (SELECT COALESCE(SUM(t.amount), 0) FROM reward_transactions t WHERE t.student_id = u.id) AS balance
       FROM users u WHERE u.family_id = ? AND u.role = 'student' ORDER BY u.created_at, u.id`,
    )
    .bind(familyId)
    .all<{ id: string; name: string; balance: number }>();
  const summaries = summarizeReprice(changes);
  const perStudent = students.flatMap(s => {
    const summary = summaries.find(x => x.studentId === s.id);
    if (!summary) return [];
    return [{ ...summary, name: s.name, balanceBefore: s.balance, balanceAfter: Math.round((s.balance + summary.delta) * 100) / 100 }];
  });
  return { changes, students: perStudent };
}

/** Parent-only preview: nothing is written. An empty `students` list means everything is already at today's rates. */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can recalculate rewards" }, 403);

  const { students } = await preview(context.env.DB, user.familyId);
  return json({ students }, 200);
};

/**
 * Parent-only: re-price all graded work at today's rates, in one transaction. Unpaid work is re-priced in place;
 * paid-out work keeps its payout and gets a catch-up entry for the difference (which may be negative after a rate
 * cut — the pop-up warns first). Returns what was applied.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getSessionUser(context.env.DB, context.request);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (user.role !== "parent") return json({ error: "Only a parent can recalculate rewards" }, 403);

  const db = context.env.DB;
  const { changes, students } = await preview(db, user.familyId);
  if (changes.length > 0) {
    const now = await db.prepare("SELECT datetime('now') AS now").first<{ now: string }>();
    await db.batch(repriceStatements(db, changes, { familyId: user.familyId, actorId: user.id, createdAt: now!.now }));
  }
  return json({ students }, 200);
};
