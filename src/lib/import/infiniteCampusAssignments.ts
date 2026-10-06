import { normalize, stripTerm } from "./normalize";
import type { ImportedItem, ParseResult, SkippedLine } from "./types";

// Infinite Campus "Assignments" list as copied from the page (checked against a real paste, Oct 5 2026):
//
//   Tuesday 08/18/2026            <- due date heading ("Today" may follow on its own line)
//   Assignment                    <- starts each item
//   Worksheet 1.3 - Line Segments/ 1.4 - Distance
//   Geometry -S1                  <- class, with the term appended
//   CommentsShould have been …    <- optional teacher comment
//   Late | Missing | Dropped      <- optional flags, one per line
//   Score
//   3/3(100%)                     <- optional; no score = not graded yet
const DATE_HEADING = /^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/i;
const SCORE_LINE = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:\(.*\))?$/;
const FLAGS = new Set(["late", "missing", "dropped", "incomplete", "exempt", "turned in", "absent", "cheated"]);
const pad = (n: number) => String(n).padStart(2, "0");

/** Two or more "Assignment" marker lines plus a dated heading = the Assignments list, not the notification feed. */
export function looksLikeAssignmentList(text: string): boolean {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  return lines.filter(l => l === "Assignment").length >= 1 && lines.some(l => DATE_HEADING.test(l));
}

function resolveClass(raw: string, knownClasses: string[]): string {
  const plain = stripTerm(raw);
  return knownClasses.find(c => normalize(c) === normalize(plain))?.trim() ?? plain;
}

export function parseAssignmentList(text: string, knownClasses: string[] = []): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const items: ImportedItem[] = [];
  const skipped: SkippedLine[] = [];
  const seen = new Map<string, number>();
  let due: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(DATE_HEADING);
    if (heading) {
      due = `${heading[3]}-${pad(Number(heading[1]))}-${pad(Number(heading[2]))}`;
      continue;
    }
    if (lines[i] !== "Assignment") continue; // "Today", page chrome, etc.

    const title = lines[i + 1];
    const classRaw = lines[i + 2];
    if (!title || !classRaw || title === "Assignment" || DATE_HEADING.test(title)) continue;

    // Everything after the class up to the next item or heading belongs to this item.
    let j = i + 3;
    const flags: string[] = [];
    let score: { earned: number; possible: number } | null = null;
    let badScore = false;
    while (j < lines.length && lines[j] !== "Assignment" && !DATE_HEADING.test(lines[j])) {
      const l = lines[j];
      const lower = l.toLowerCase();
      if (FLAGS.has(lower)) flags.push(lower);
      else if (lower === "score") {
        const m = lines[j + 1]?.match(SCORE_LINE);
        if (m) {
          score = { earned: Number(m[1]), possible: Number(m[2]) };
          j++;
        } else if (lines[j + 1] && lines[j + 1] !== "Assignment" && !DATE_HEADING.test(lines[j + 1])) {
          badScore = true; // e.g. a letter grade or a dash
          j++;
        }
      }
      // "Comments…", "Today" and anything else are ignored.
      j++;
    }
    const raw = lines.slice(i, j).join(" · ");
    i = j - 1;

    const className = resolveClass(classRaw, knownClasses);
    if (flags.includes("dropped") || flags.includes("exempt")) {
      skipped.push({ raw, reason: flags.includes("dropped") ? "Dropped in Campus (doesn't count)" : "Exempt in Campus" });
      continue;
    }

    let item: ImportedItem;
    const base = { className, title, flags: flags.filter(f => f !== "missing"), date: due, dueDateExact: true, raw };
    if (flags.includes("missing")) {
      item = { ...base, status: "missing", grade: null, points: score };
    } else if (score && score.possible > 0) {
      item = { ...base, status: "graded", grade: Math.max(0, Math.round((score.earned / score.possible) * 100)), points: score };
    } else if (score || badScore) {
      skipped.push({ raw, reason: score ? "Out of 0 points (extra credit?) — enter it by hand if it should count" : "Score isn't in points — enter it by hand" });
      continue;
    } else {
      item = { ...base, status: "pending", grade: null, points: null };
    }

    // The same name twice in one class: keep the later-dated one.
    const key = `${normalize(className)}\u0000${normalize(title)}`;
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, items.length);
      items.push(item);
    } else if ((item.date ?? "") >= (items[at].date ?? "")) {
      items[at] = item;
    }
  }
  return { items, skipped, complete: true };
}
