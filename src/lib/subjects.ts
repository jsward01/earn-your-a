import { SUBJECTS } from "../data/mockData";

/**
 * The subjects to offer in a subject picker: the student's own classes (every subject on their assignments, which for
 * imported work is the class name from the school's grade book), A–Z. Falls back to a generic list for a student with
 * no work yet. The picker adds "Other…" for anything else.
 */
export function subjectOptions(assignments: readonly { subject: string }[]): string[] {
  const names = new Set<string>();
  for (const a of assignments) {
    const s = a.subject.trim();
    if (s) names.add(s);
  }
  if (names.size === 0) return [...SUBJECTS];
  return [...names].sort((a, b) => a.localeCompare(b));
}
