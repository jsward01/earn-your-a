import { computeAssignmentReward, type FullRewardSettings } from "./rewards";
import { isIsoDate } from "./assignmentEdits";

/** One assignment as the recalculation sees it: its current state plus what the ledger recorded for it. */
export interface RepriceAssignment {
  id: string;
  studentId: string;
  title: string;
  type: "assignment" | "quiz" | "test";
  status: "pending" | "graded" | "missing";
  grade: number | null;
  historyOnly: boolean;
  /** Settled by a payout: locked, so a change becomes a catch-up entry instead of a re-priced row. */
  paid: boolean;
  /** Sum of the ledger rows tied to it (null = none, i.e. $0). */
  recorded: number | null;
}

export interface RepriceChange {
  assignmentId: string;
  studentId: string;
  title: string;
  type: RepriceAssignment["type"];
  paid: boolean;
  before: number;
  after: number;
}

const roundCents = (n: number): number => Math.round(n * 100) / 100;

/**
 * "Recalculate all graded work": what every assignment would be worth under today's settings, compared with what the
 * ledger recorded. Only the ones whose amount would change are returned. Ungraded and history work price to $0 as
 * always, so they only show up if something was somehow recorded for them.
 */
export function planReprice(assignments: RepriceAssignment[], settings: FullRewardSettings): RepriceChange[] {
  const changes: RepriceChange[] = [];
  for (const a of assignments) {
    const before = roundCents(a.recorded ?? 0);
    const after = computeAssignmentReward(a, settings)?.amount ?? 0;
    if (before === after) continue;
    changes.push({ assignmentId: a.id, studentId: a.studentId, title: a.title, type: a.type, paid: a.paid, before, after });
  }
  return changes;
}

export interface RepriceGroup {
  type: RepriceAssignment["type"];
  before: number;
  after: number;
  count: number;
  /** after − before, times count. */
  delta: number;
}

export interface StudentRepriceSummary {
  studentId: string;
  /** Unpaid work, re-priced in place. */
  unpaid: { count: number; delta: number };
  /** Paid-out work, caught up with one entry per item (shown as one line on the Balance page). */
  paid: { count: number; delta: number };
  delta: number;
  /** "43 assignments $3 → $5" style lines, biggest change first. */
  groups: RepriceGroup[];
}

/** Totals per student for the confirm pop-up. */
export function summarizeReprice(changes: RepriceChange[]): StudentRepriceSummary[] {
  const byStudent = new Map<string, StudentRepriceSummary>();
  for (const c of changes) {
    let s = byStudent.get(c.studentId);
    if (!s) {
      s = { studentId: c.studentId, unpaid: { count: 0, delta: 0 }, paid: { count: 0, delta: 0 }, delta: 0, groups: [] };
      byStudent.set(c.studentId, s);
    }
    const diff = roundCents(c.after - c.before);
    const bucket = c.paid ? s.paid : s.unpaid;
    bucket.count += 1;
    bucket.delta = roundCents(bucket.delta + diff);
    s.delta = roundCents(s.delta + diff);
    let g = s.groups.find(x => x.type === c.type && x.before === c.before && x.after === c.after);
    if (!g) {
      g = { type: c.type, before: c.before, after: c.after, count: 0, delta: 0 };
      s.groups.push(g);
    }
    g.count += 1;
    g.delta = roundCents(g.delta + diff);
  }
  for (const s of byStudent.values()) s.groups.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return [...byStudent.values()];
}

export const CATCH_UP_KIND = "reprice";

/**
 * The optional "recalculate work due on or after" date: absent = all work; otherwise a real calendar day
 * (isIsoDate alone would accept 2026-02-30).
 */
export function parseFromDate(value: unknown): { from: string | null } | { error: string } {
  if (value === undefined || value === null || value === "") return { from: null };
  const ms = typeof value === "string" && isIsoDate(value) ? Date.parse(`${value}T00:00:00Z`) : NaN;
  if (typeof value !== "string" || Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    return { error: "from must be a real date, YYYY-MM-DD" };
  }
  return { from: value };
}

/** The family's assignments (only those due on or after `from`, when given) with their recorded ledger amounts. */
export async function loadRepriceAssignments(db: D1Database, familyId: string, from: string | null): Promise<RepriceAssignment[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.student_id, a.title, a.type, a.status, a.grade, a.history_only, a.payout_id,
              (SELECT SUM(t.amount) FROM reward_transactions t WHERE t.assignment_id = a.id) AS recorded
       FROM assignments a WHERE a.family_id = ? AND (? IS NULL OR a.due_date >= ?)`,
    )
    .bind(familyId, from, from)
    .all<{
      id: string; student_id: string; title: string; type: RepriceAssignment["type"]; status: RepriceAssignment["status"];
      grade: number | null; history_only: number; payout_id: string | null; recorded: number | null;
    }>();
  return results.map(r => ({
    id: r.id,
    studentId: r.student_id,
    title: r.title,
    type: r.type,
    status: r.status,
    grade: r.grade,
    historyOnly: r.history_only === 1,
    paid: r.payout_id !== null,
    recorded: r.recorded,
  }));
}

const money = (n: number): string => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/**
 * The writes for one recalculation, for a single `db.batch` (one transaction):
 * - Unpaid work: its ledger row is replaced with the amount at today's rates (as a re-grade would).
 * - Paid work stays locked and its payout is untouched: a catch-up row (kind 'reprice') for the difference is tied to
 *   the item, so the item's recorded total becomes the new amount and running this again finds nothing left to do.
 * Each item gets a line in its edit history. `createdAt` is shared so the Balance page can show one catch-up line.
 */
export function repriceStatements(
  db: D1Database,
  changes: RepriceChange[],
  ctx: { familyId: string; actorId: string; createdAt: string },
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (const c of changes) {
    if (c.paid) {
      statements.push(
        db
          .prepare(
            `INSERT INTO reward_transactions (id, family_id, student_id, assignment_id, amount, reason, kind, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, '${CATCH_UP_KIND}', ?, ?)`,
          )
          .bind(crypto.randomUUID(), ctx.familyId, c.studentId, c.assignmentId, roundCents(c.after - c.before), c.title, ctx.actorId, ctx.createdAt),
      );
    } else {
      statements.push(db.prepare("DELETE FROM reward_transactions WHERE assignment_id = ?").bind(c.assignmentId));
      if (c.after !== 0) {
        statements.push(
          db
            .prepare(
              `INSERT INTO reward_transactions (id, family_id, student_id, assignment_id, amount, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(crypto.randomUUID(), ctx.familyId, c.studentId, c.assignmentId, c.after, c.title, ctx.createdAt),
        );
      }
    }
    const summary = c.paid
      ? `Rate change catch-up after payout: ${money(c.before)} → ${money(c.after)}`
      : `Re-priced at current rates: ${money(c.before)} → ${money(c.after)}`;
    statements.push(
      db
        .prepare(
          `INSERT INTO assignment_history (id, family_id, assignment_id, student_id, actor_id, action, summary, ledger_before, ledger_after)
           VALUES (?, ?, ?, ?, ?, 'update', ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), ctx.familyId, c.assignmentId, c.studentId, ctx.actorId, summary, c.before || null, c.after || null),
    );
  }
  return statements;
}
