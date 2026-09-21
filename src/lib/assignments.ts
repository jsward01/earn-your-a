import type { Assignment } from "../types";
import { daysUntilDate } from "./dates";

export interface AssignmentApiRow {
  id: string;
  title: string;
  subject: string;
  type: Assignment["type"];
  dueDate: string;
  status: Assignment["status"];
  grade: number | null;
  makeupDeadline: string | null;
  makeupUsed: boolean;
  recordedReward: number | null;
  payoutId: string | null;
  paidAt: string | null;
}

export function fromApiRow(row: AssignmentApiRow): Assignment {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    type: row.type,
    dueDate: row.dueDate,
    status: row.status,
    grade: row.grade,
    daysLeft: row.makeupDeadline ? daysUntilDate(row.makeupDeadline) : null,
    makeupAvailable: row.makeupDeadline !== null && !row.makeupUsed,
    recordedReward: row.recordedReward ?? null,
    payoutId: row.payoutId ?? null,
    paidAt: row.paidAt ?? null,
  };
}

/**
 * Split ungraded work into what is waiting on the parent (due date already passed, so it can be
 * graded) and what is still coming up (due today or later). Due-today stays in "coming up": the
 * day is not over, so it is not yet late to grade.
 */
export function splitPending(assignments: Assignment[], now: Date = new Date()): { needsGrade: Assignment[]; comingUp: Assignment[] } {
  const pending = assignments.filter(a => a.status === "pending");
  const byDue = (a: Assignment, b: Assignment) => a.dueDate.localeCompare(b.dueDate);
  return {
    needsGrade: pending.filter(a => daysUntilDate(a.dueDate, now) < 0).sort(byDue),
    comingUp: pending.filter(a => daysUntilDate(a.dueDate, now) >= 0).sort(byDue),
  };
}
