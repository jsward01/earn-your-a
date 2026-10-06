import type { Assignment, AssignmentType } from "../../types";
import { importKey, normalize } from "./normalize";
import type { ImportedItem } from "./types";
import { penaltyAmountFor, rewardAmountFor, type RewardRules } from "../rewards";

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
  /** For new work: an app item in the same class with a near-identical title (likely the same assignment). */
  similar?: Assignment;
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

  const rows = items.map((item): PlanRow => {
    const existing = byKey.get(importKey(item.className, item.title)) ?? null;
    const incoming = item.status === "graded" ? `${item.grade}%` : item.status;

    if (!existing) {
      const note = item.status === "pending" ? "Not in the app yet — no score yet, so it's added as upcoming work" : "Not in the app yet";
      return { item, kind: "new", existing, type: guessType(item.title), selected: true, note };
    }
    // No score in the school system yet: never touches what the app already has.
    if (item.status === "pending") {
      return { item, kind: "unchanged", existing, type: existing.type, selected: false, note: "Already in the app; no score yet" };
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

  // New work whose title nearly matches an unmatched app item in the same class ("Daniel el Detective" vs
  // "Daniel el Detective - Reading Assessment") is probably the same assignment under a slightly different name.
  // Leave it unticked so it can't pay twice.
  const matched = new Set(rows.flatMap(r => (r.existing ? [r.existing.id] : [])));
  for (const r of rows) {
    if (r.kind !== "new") continue;
    const similar = assignments.find(a => !matched.has(a.id) && nearTitle(a, r.item.className, r.item.title));
    if (!similar) continue;
    matched.add(similar.id);
    r.similar = similar;
    r.selected = false;
    r.note = `Might be “${similar.title}” already in the app (${describe(similar)}). Tick only if it's a different assignment.`;
  }
  return rows;
}

/** Same class, and one title starts with the other (ignoring case/punctuation), with at least 5 characters in common. */
function nearTitle(a: Assignment, className: string, title: string): boolean {
  if (normalize(a.subject) !== normalize(className)) return false;
  const x = normalize(a.title), y = normalize(title);
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 5 && short !== long && long.startsWith(short) && /[\s\-:(]/.test(long[short.length] ?? "");
}

/**
 * App work that a complete list doesn't mention (graded or missing only — upcoming work the student added may not be
 * posted yet). Worth a look: renamed, dropped, or entered by mistake.
 */
export function notInList(rows: PlanRow[], assignments: Assignment[]): Assignment[] {
  const seen = new Set(rows.flatMap(r => [r.existing?.id, r.similar?.id]).filter(Boolean));
  return assignments.filter(a => a.status !== "pending" && !seen.has(a.id));
}

/** What a row would add to the balance, priced at today's rates (the server does the real pricing on save). */
export function estimateDelta(r: PlanRow, rules: RewardRules): number {
  const after =
    r.item.status !== "graded" || r.item.grade === null
      ? 0
      : r.item.grade >= rules.passingThreshold
        ? rewardAmountFor(r.type, rules)
        : -penaltyAmountFor(r.type, rules);
  return after - (r.existing?.recordedReward ?? 0);
}

/** Known class names for the parser: whatever subjects the student's work already uses. */
export function knownClasses(assignments: Assignment[]): string[] {
  return [...new Set(assignments.map(a => a.subject))];
}
