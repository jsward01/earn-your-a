import type { AssignmentRow } from "./assignments";

/** The user-editable part of an assignment, in the shape the API speaks. */
export interface Fields {
  title: string;
  subject: string;
  type: AssignmentRow["type"];
  dueDate: string;
  status: AssignmentRow["status"];
  grade: number | null;
}

export type FieldChange = { from: string | number | null; to: string | number | null };
export type Changes = Partial<Record<keyof Fields, FieldChange>>;

export function fieldsFromRow(row: AssignmentRow): Fields {
  return { title: row.title, subject: row.subject, type: row.type, dueDate: row.due_date, status: row.status, grade: row.grade };
}

const KEYS: (keyof Fields)[] = ["title", "subject", "type", "dueDate", "status", "grade"];

export function diffFields(before: Fields, after: Fields): Changes {
  const changes: Changes = {};
  for (const k of KEYS) {
    if (before[k] !== after[k]) changes[k] = { from: before[k], to: after[k] };
  }
  return changes;
}

const LABEL: Record<keyof Fields, string> = {
  title: "Title", subject: "Subject", type: "Type", dueDate: "Due date", status: "Status", grade: "Grade",
};

function show(key: keyof Fields, v: string | number | null): string {
  if (v === null) return "none";
  if (key === "grade") return `${v}%`;
  if (key === "title") return `"${v}"`;
  return String(v);
}

/** "Grade 62% → 91% · Status pending → graded" */
export function summarizeChanges(changes: Changes): string {
  return KEYS.filter(k => changes[k])
    .map(k => `${LABEL[k]} ${show(k, changes[k]!.from)} → ${show(k, changes[k]!.to)}`)
    .join(" · ");
}

/** Only these fields feed the ledger; renaming or moving a due date must never re-price anything. */
export function affectsLedger(changes: Changes): boolean {
  return !!(changes.type || changes.status || changes.grade);
}

export type Verdict = { ok: true } | { ok: false; error: string };

const GRADED_ONLY_BY_PARENT = "Only a parent can enter grades or mark work graded or missing.";

/** A student may add work, but always as pending — grading is a parent's job. */
export function checkStudentCreate(body: { status?: string; grade?: number | null }): Verdict {
  if (body.status !== undefined && body.status !== "pending") return { ok: false, error: GRADED_ONLY_BY_PARENT };
  if (body.grade !== undefined && body.grade !== null) return { ok: false, error: GRADED_ONLY_BY_PARENT };
  return { ok: true };
}

/** A student may only touch details of work that hasn't been graded or marked missing, and never its status/grade. */
export function checkStudentEdit(existingStatus: string, body: { status?: string; grade?: number | null }): Verdict {
  if (existingStatus !== "pending") return { ok: false, error: "Only a parent can change work that has been graded or marked missing." };
  if (body.status !== undefined && body.status !== "pending") return { ok: false, error: GRADED_ONLY_BY_PARENT };
  if (body.grade !== undefined && body.grade !== null) return { ok: false, error: GRADED_ONLY_BY_PARENT };
  return { ok: true };
}

/** Deleting graded/missing work would erase a penalty or reward, so it's a parent's call too. */
export function checkStudentDelete(existingStatus: string): Verdict {
  if (existingStatus !== "pending") return { ok: false, error: "Only a parent can delete work that has been graded or marked missing." };
  return { ok: true };
}

/** null when fine, otherwise the message to send back. Extra credit above 100 is allowed. */
export function gradeError(grade: unknown): string | null {
  if (grade === null || grade === undefined) return null;
  if (typeof grade !== "number" || !Number.isFinite(grade)) return "grade must be a number";
  if (grade < 0 || grade > 200) return "grade must be between 0 and 200";
  return null;
}

export const isIsoDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
