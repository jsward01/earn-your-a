import { classKey } from "../../src/lib/import/normalize";
import { computeAssignmentReward, type FullRewardSettings } from "./rewards";

/**
 * What a parent chose for one of a student's classes (stored in `excluded_classes`; no row = "pays"):
 * - pays: the normal rules.
 * - track: imported and graded, counts in averages, but always $0 (assignments.track_only).
 * - leave_out: skipped by grade imports entirely.
 */
export type ClassMode = "pays" | "track" | "leave_out";
export const CLASS_MODES: ClassMode[] = ["pays", "track", "leave_out"];

/** The key a class is stored and matched by: "Spanish II -S1" and "spanish ii" are the same class. */
export const classKeyOf = classKey;

export async function loadClassModes(db: D1Database, studentId: string): Promise<Map<string, Exclude<ClassMode, "pays">>> {
  const { results } = await db
    .prepare("SELECT class_key, mode FROM excluded_classes WHERE student_id = ?")
    .bind(studentId)
    .all<{ class_key: string; mode: string }>();
  return new Map(results.map(r => [r.class_key, r.mode === "track" ? "track" : "leave_out"]));
}

/** Is new work in this class (for this student) Track only? */
export async function isTrackOnlyClass(db: D1Database, studentId: string, subject: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT mode FROM excluded_classes WHERE student_id = ? AND class_key = ?")
    .bind(studentId, classKeyOf(subject))
    .first<{ mode: string }>();
  return row?.mode === "track";
}

/** One unpaid assignment as a class-setting change sees it. */
export interface ClassWork {
  id: string;
  subject: string;
  title: string;
  type: "assignment" | "quiz" | "test";
  status: "pending" | "graded" | "missing";
  grade: number | null;
  historyOnly: boolean;
  trackOnly: boolean;
  /** Sum of its ledger rows (null = none). */
  recorded: number | null;
}

export interface ClassWorkChange {
  id: string;
  title: string;
  before: number;
  after: number;
}

const roundCents = (n: number): number => Math.round(n * 100) / 100;

/**
 * Applying a Pays / Track only setting to the work already in the app: every unpaid item in the class whose flag
 * differs is switched, and priced again under the new flag (Track only = $0; Pays = today's rates, like a re-grade).
 * Callers pass only unpaid work: paid-out items keep what they were paid.
 */
export function planClassChange(work: ClassWork[], classKey: string, trackOnly: boolean, settings: FullRewardSettings): ClassWorkChange[] {
  return work
    .filter(w => w.trackOnly !== trackOnly && classKeyOf(w.subject) === classKey)
    .map(w => ({
      id: w.id,
      title: w.title,
      before: roundCents(w.recorded ?? 0),
      after: computeAssignmentReward({ ...w, trackOnly }, settings)?.amount ?? 0,
    }));
}

export async function loadUnpaidWork(db: D1Database, studentId: string): Promise<ClassWork[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.subject, a.title, a.type, a.status, a.grade, a.history_only, a.track_only,
              (SELECT SUM(t.amount) FROM reward_transactions t WHERE t.assignment_id = a.id) AS recorded
       FROM assignments a WHERE a.student_id = ? AND a.payout_id IS NULL`,
    )
    .bind(studentId)
    .all<{
      id: string; subject: string; title: string; type: ClassWork["type"]; status: ClassWork["status"]; grade: number | null;
      history_only: number; track_only: number; recorded: number | null;
    }>();
  return results.map(r => ({
    id: r.id, subject: r.subject, title: r.title, type: r.type, status: r.status, grade: r.grade,
    historyOnly: r.history_only === 1, trackOnly: r.track_only === 1, recorded: r.recorded,
  }));
}

const money = (n: number): string => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/**
 * The writes for applying a class setting to its unpaid work, for one `db.batch`: flip the flag, replace the ledger
 * row (as a re-grade would), and record a history line. Going Track only also closes any retake window (there's no
 * penalty left to win back); going back to Pays doesn't open one after the fact.
 */
export function classChangeStatements(
  db: D1Database,
  changes: ClassWorkChange[],
  trackOnly: boolean,
  ctx: { familyId: string; studentId: string; actorId: string; className: string },
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (const c of changes) {
    statements.push(
      trackOnly
        ? db.prepare("UPDATE assignments SET track_only = 1, makeup_deadline = NULL, makeup_used = 0, updated_at = datetime('now') WHERE id = ?").bind(c.id)
        : db.prepare("UPDATE assignments SET track_only = 0, updated_at = datetime('now') WHERE id = ?").bind(c.id),
    );
    if (c.before !== c.after) {
      statements.push(db.prepare("DELETE FROM reward_transactions WHERE assignment_id = ?").bind(c.id));
      if (c.after !== 0) {
        statements.push(
          db
            .prepare(`INSERT INTO reward_transactions (id, family_id, student_id, assignment_id, amount, reason) VALUES (?, ?, ?, ?, ?, ?)`)
            .bind(crypto.randomUUID(), ctx.familyId, ctx.studentId, c.id, c.after, c.title),
        );
      }
    }
    const summary = trackOnly
      ? `${ctx.className} set to Track only (no reward): ${money(c.before)} → ${money(c.after)}`
      : `${ctx.className} set to Pays: ${money(c.before)} → ${money(c.after)}`;
    statements.push(
      db
        .prepare(
          `INSERT INTO assignment_history (id, family_id, assignment_id, student_id, actor_id, action, summary, ledger_before, ledger_after)
           VALUES (?, ?, ?, ?, ?, 'update', ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), ctx.familyId, c.id, ctx.studentId, ctx.actorId, summary, c.before || null, c.after || null),
    );
  }
  return statements;
}
