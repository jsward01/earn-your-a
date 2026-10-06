import type { Assignment, AssignmentType } from "../../types";
import { importKey, normalize } from "./normalize";
import type { ImportedItem } from "./types";

export type PlanKind = "new" | "update" | "unchanged" | "locked";

export interface PlanRow {
  item: ImportedItem;
  kind: PlanKind;
  /** The app's existing assignment, when one matched. */
  existing: Assignment | null;
  /** Type to save with: the existing item's type, or a guess from the name for new work (the parent can change it). */
  type: AssignmentType;
  /** Pre-ticked on the checklist. */
  selected: boolean;
  /** Plain-words explanation shown on the row. */
  note: string;
}

/** Guess the kind of work from its name: Campus has no type field, but names often say TEST or QUIZ. */
export function guessType(title: string): AssignmentType {
  const t = normalize(title);
  if (/\b(test|exam|midterm|final)s?\b/.test(t) && !/\bstudy guide\b|\breview\b|\bpractice\b|\bpre-?test\b/.test(t)) return "test";
  if (/\bquiz(zes)?\b/.test(t) && !/\bquizlet\b/.test(t)) return "quiz";
  return "assignment";
}

function describe(a: Assignment): string {
  if (a.status === "graded") return `${a.grade}%`;
  return a.status; // "missing" | "pending"
}

/**
 * Compare imported items with the student's assignments (matched by class + title, ignoring case and punctuation).
 * Only items that would actually change something are pre-ticked.
 */
export function buildPlan(items: ImportedItem[], assignments: Assignment[]): PlanRow[] {
  const byKey = new Map<string, Assignment>();
  for (const a of assignments) {
    const key = importKey(a.subject, a.title);
    if (!byKey.has(key)) byKey.set(key, a);
  }

  return items.map((item): PlanRow => {
    const existing = byKey.get(importKey(item.className, item.title)) ?? null;
    const incoming = item.status === "graded" ? `${item.grade}%` : "missing";

    if (!existing) {
      return { item, kind: "new", existing, type: guessType(item.title), selected: true, note: "Not in the app yet" };
    }
    const same = existing.status === item.status && (item.status === "missing" || existing.grade === item.grade);
    if (same) return { item, kind: "unchanged", existing, type: existing.type, selected: false, note: "Already up to date" };
    if (existing.payoutId) {
      return {
        item, kind: "locked", existing, type: existing.type, selected: false,
        note: `Paid out at ${describe(existing)} — Campus now says ${incoming}. Use ± Adjust on the Balance page to correct it.`,
      };
    }
    // Campus saying "missing" about something the app already has a grade for is usually an old notification.
    if (item.status === "missing" && existing.status === "graded") {
      return {
        item, kind: "update", existing, type: existing.type, selected: false,
        note: `The app has ${describe(existing)}; Campus flagged it missing. Probably an older notice — tick it only if it's really missing.`,
      };
    }
    return { item, kind: "update", existing, type: existing.type, selected: true, note: `${describe(existing)} → ${incoming}` };
  });
}

/** Known class names for the parser: whatever subjects the student's work already uses. */
export function knownClasses(assignments: Assignment[]): string[] {
  return [...new Set(assignments.map(a => a.subject))];
}
