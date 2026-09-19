export interface AssignmentRow {
  id: string;
  family_id: string;
  student_id: string;
  title: string;
  subject: string;
  type: "assignment" | "quiz" | "test";
  due_date: string;
  status: "pending" | "graded" | "missing";
  grade: number | null;
  makeup_deadline: string | null;
  makeup_used: number;
  /** SUM of the ledger rows tied to this assignment; NULL when it has none. Only present on rows read via ASSIGNMENT_SELECT. */
  recorded_reward?: number | null;
  /** The payout that settled (archived + locked) this item; NULL while it's still current. */
  payout_id?: string | null;
  /** When that payout was approved. Only present on rows read via ASSIGNMENT_SELECT. */
  paid_at?: string | null;
}

/**
 * House rule: a missing or low (<passingThreshold) assignment/test/quiz gets a
 * fixed makeup window from the moment it first enters that state. Editing the
 * grade/status while already inside a window does not reset its deadline —
 * once the window closes the penalty is meant to lock in permanently.
 */
export function nextMakeupState(
  current: { deadline: string | null },
  status: string,
  grade: number | null,
  passingThreshold: number,
  makeupWindowDays: number,
  now: Date,
): { deadline: string | null; used: number } {
  const needsMakeup = status === "missing" || (status === "graded" && grade !== null && grade < passingThreshold);

  if (!needsMakeup) {
    return { deadline: null, used: current.deadline ? 1 : 0 };
  }
  if (current.deadline) {
    return { deadline: current.deadline, used: 0 };
  }
  const d = new Date(now);
  d.setDate(d.getDate() + makeupWindowDays);
  return { deadline: d.toISOString().slice(0, 10), used: 0 };
}

/**
 * Which finished work a payout settles. Graded and missing items are archived, EXCEPT ones whose makeup window is
 * still open — a failed test with days left to retake must stay editable, or the retake could never reverse its
 * penalty (that's what the holdback is for). Pending work is never archived.
 */
export const ARCHIVE_ON_PAYOUT_WHERE = `payout_id IS NULL AND status IN ('graded', 'missing') AND NOT (makeup_deadline IS NOT NULL AND makeup_deadline >= date('now'))`;

export const ARCHIVED_MESSAGE = "This work was paid out, so it's archived under Past Grades and can't be edited.";

export function toAssignmentJson(row: AssignmentRow) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    type: row.type,
    dueDate: row.due_date,
    status: row.status,
    grade: row.grade,
    makeupDeadline: row.makeup_deadline,
    makeupUsed: row.makeup_used === 1,
    // What the ledger actually recorded for this item (null = nothing, i.e. $0). Cards show this for graded
    // work so they can't disagree with the money even after the family's reward settings change.
    recordedReward: row.recorded_reward ?? null,
    // Set once a payout has settled this item: it's archived under Past Grades and can no longer be edited.
    payoutId: row.payout_id ?? null,
    paidAt: row.paid_at ?? null,
  };
}

export const ASSIGNMENT_SELECT = `SELECT a.*, (SELECT SUM(t.amount) FROM reward_transactions t WHERE t.assignment_id = a.id) AS recorded_reward, (SELECT p.resolved_at FROM payout_requests p WHERE p.id = a.payout_id) AS paid_at FROM assignments a`;

export async function getAssignmentRow(db: D1Database, id: string): Promise<AssignmentRow | null> {
  return db.prepare(`${ASSIGNMENT_SELECT} WHERE a.id = ?`).bind(id).first<AssignmentRow>();
}
