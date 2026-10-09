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
  historyOnly?: boolean;
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
    historyOnly: row.historyOnly ?? false,
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

export interface DueGroups {
  /** Missing or below-passing work whose makeup window is still open, soonest deadline first. */
  fixIt: Assignment[];
  /** Ungraded work whose due date has passed: turned in (or not) and waiting on a parent to grade it. */
  waiting: Assignment[];
  today: Assignment[];
  tomorrow: Assignment[];
  /** Due 2–6 days from today. */
  thisWeek: Assignment[];
  /** Due a week or more from today. */
  later: Assignment[];
}

/**
 * The student's "what's due" view. History work (before rewards started) and anything a payout already settled are
 * left out: neither can earn or cost anything any more. A missing item with no open makeup window is also left out —
 * there is nothing left for the student to do about it.
 */
export function groupDueWork(assignments: Assignment[], passingThreshold: number, now: Date = new Date()): DueGroups {
  const live = assignments.filter(a => !a.historyOnly && !a.payoutId);
  const byDue = (a: Assignment, b: Assignment) => a.dueDate.localeCompare(b.dueDate);
  const pending = live.filter(a => a.status === "pending").sort(byDue);
  const days = (a: Assignment) => daysUntilDate(a.dueDate, now);
  const needsFix = (a: Assignment) =>
    a.status === "missing" || (a.status === "graded" && a.grade !== null && a.grade < passingThreshold);

  return {
    fixIt: live
      .filter(a => needsFix(a) && a.makeupAvailable && (a.daysLeft ?? 0) > 0)
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || byDue(a, b)),
    waiting: pending.filter(a => days(a) < 0),
    today: pending.filter(a => days(a) === 0),
    tomorrow: pending.filter(a => days(a) === 1),
    thisWeek: pending.filter(a => days(a) >= 2 && days(a) <= 6),
    later: pending.filter(a => days(a) >= 7),
  };
}
