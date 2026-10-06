import { normalize, stripTerm } from "./normalize";
import type { ExtractedItem, GradeSource, ImportedItem, ParseResult, SkippedLine } from "./types";

/** Any school system or class app, read by Claude (text and/or screenshots). */
export const otherSystem: GradeSource = {
  kind: "ai",
  id: "other",
  name: "Other school system (read by AI)",
  instructions:
    "For PowerSchool, Skyward, Synergy/ParentVUE, Aeries, Canvas, Schoology, Google Classroom, or anything else: open the page that lists " +
    "assignments with scores (often Grades, Assignments, or a class's detail page), then select it all, copy, and paste below — or upload screenshots. " +
    "Claude (AI) reads it into the same checklist; double-check the points on each row.",
};

const ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function resolveClass(raw: string, knownClasses: string[]): string {
  const plain = stripTerm(raw.trim());
  return knownClasses.find(c => normalize(c) === normalize(plain))?.trim() ?? plain;
}

/** Turn the AI reader's list into import items: points → %, dropped/exempt skipped, the app's own class spelling. */
export function fromExtracted(extracted: ExtractedItem[], knownClasses: string[] = []): ParseResult {
  const items: ImportedItem[] = [];
  const skipped: SkippedLine[] = [];
  const seen = new Map<string, number>();

  for (const x of extracted) {
    const title = x.title?.trim();
    const className = resolveClass(x.className ?? "", knownClasses);
    const score =
      x.pointsEarned !== null && x.pointsPossible !== null ? `${x.pointsEarned}/${x.pointsPossible}` : x.percent !== null ? `${x.percent}%` : "";
    const raw = [className, title, score, x.dueDate ?? "", ...x.flags].filter(Boolean).join(" · ");
    if (!title || !className) {
      skipped.push({ raw, reason: "Missing a class or assignment name" });
      continue;
    }
    if (x.status === "dropped" || x.status === "exempt") {
      skipped.push({ raw, reason: x.status === "dropped" ? "Dropped (doesn't count)" : "Exempt" });
      continue;
    }

    const flags = x.flags.map(f => f.trim().toLowerCase()).filter(f => f && !["missing", "dropped", "exempt"].includes(f));
    const date = x.dueDate && ISO.test(x.dueDate) ? x.dueDate : null;
    const points = x.pointsEarned !== null && x.pointsPossible !== null ? { earned: x.pointsEarned, possible: x.pointsPossible } : null;
    const base = { className, title, flags, date, dueDateExact: date !== null, raw, points };

    let item: ImportedItem;
    if (x.status === "missing") {
      item = { ...base, status: "missing", grade: null };
    } else if (x.status === "pending") {
      item = { ...base, status: "pending", grade: null, points: null };
    } else if (points && points.possible > 0) {
      item = { ...base, status: "graded", grade: Math.max(0, Math.round((points.earned / points.possible) * 100)) };
    } else if (x.percent !== null && Number.isFinite(x.percent)) {
      item = { ...base, status: "graded", grade: Math.max(0, Math.round(x.percent)) };
    } else {
      skipped.push({ raw, reason: points ? "Out of 0 points (extra credit?) — enter it by hand if it should count" : "No score in points or percent — enter it by hand" });
      continue;
    }

    const key = `${normalize(className)}\u0000${normalize(title)}`;
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, items.length);
      items.push(item);
    } else if ((item.date ?? "") >= (items[at].date ?? "")) {
      items[at] = item;
    }
  }
  // An AI read can't tell whether the paste was the whole list, so don't suggest that app work is "missing" from it.
  return { items, skipped, complete: false };
}
