import type { Assignment } from "../types";

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
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
    daysLeft: row.makeupDeadline ? daysUntil(row.makeupDeadline) : null,
    makeupAvailable: row.makeupDeadline !== null && !row.makeupUsed,
    rewardValue: row.type === "assignment" ? 3 : 20,
  };
}
