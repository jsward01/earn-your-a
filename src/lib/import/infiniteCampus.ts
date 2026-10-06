import type { GradeSource, ImportedItem, ParseResult, SkippedLine } from "./types";
import { importKey, normalize } from "./normalize";

// Infinite Campus parent-portal notifications (checked against the real list, Sep 21 2026):
//   "Susana received a score of 8 out of 10 on Concept Check 1.2 in Geometry"
//   "... in Geometry and the assignment has been flagged (Late)"
//   "Susana's assignment 2.1 Power Supplies in CE / Computer Tech I A has been flagged (Missing)"
// Everything else in the list (semester grade updates, attendance) is ignored.
const SCORE = /^(.+?) received a score of (-?[\d.]+) out of ([\d.]+) on (.+?)(?: and the assignment has been flagged \(([^)]*)\))?[.\s]*$/i;
const FLAGGED = /^(.+?)['’]s? assignment (.+?) has been flagged \(([^)]*)\)[.\s]*$/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Finds a date in a line: 9/21/2026, 9/21/26, 2026-09-21, or "Sep 21, 2026". Returns YYYY-MM-DD or null. */
export function findDate(line: string): string | null {
  let m = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = line.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const mo = Number(m[1]), d = Number(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  m = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (m) return `${m[3]}-${pad(MONTHS.indexOf(m[1].toLowerCase()) + 1)}-${pad(Number(m[2]))}`;
  return null;
}

const STAMP = String.raw`(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(?:\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})(?:,?\s*(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)?`;
const LEADING_STAMP = new RegExp(`^${STAMP}\\s*[-–|:]?\\s*`, "i");
const TRAILING_STAMP = new RegExp(`\\s*[-–|]?\\s*${STAMP}$`, "i");

/** Pull a date/time stamp off either end of a notification line: returns the bare message and the stamp's date. */
export function splitStamp(line: string): { message: string; date: string | null } {
  const lead = line.match(LEADING_STAMP);
  if (lead) return { message: line.slice(lead[0].length).trim(), date: findDate(lead[0]) };
  const trail = line.match(TRAILING_STAMP);
  if (trail) return { message: line.slice(0, trail.index).trim(), date: findDate(trail[0]) };
  return { message: line, date: null };
}

/** A line that is only a date/time stamp (how dates often land when a list is copied out of a page). */
function isDateOnly(line: string): boolean {
  const { message, date } = splitStamp(line);
  return date !== null && message.replace(/[\s,.\-–|]/g, "") === "";
}

/**
 * Split "NAME in CLASS". A title can itself contain " in " ("Practice in Pairs in Geometry"), so prefer a class the
 * app already knows (longest match wins); otherwise split at the last " in ".
 */
export function splitTitleAndClass(text: string, knownClasses: string[]): { title: string; className: string } | null {
  const known = new Map(knownClasses.map(c => [normalize(c), c.trim()]));
  const lower = text.toLowerCase();
  const positions: number[] = [];
  for (let i = lower.indexOf(" in "); i > 0; i = lower.indexOf(" in ", i + 1)) positions.push(i);
  for (const i of positions) {
    const cls = known.get(normalize(text.slice(i + 4)));
    if (cls && text.slice(0, i).trim()) return { title: text.slice(0, i).trim(), className: cls };
  }
  const idx = positions[positions.length - 1];
  if (idx === undefined) return null;
  const title = text.slice(0, idx).trim();
  const className = text.slice(idx + 4).trim();
  return title && className ? { title, className } : null;
}

function parseFlags(s: string | undefined): string[] {
  return (s ?? "").split(/[,/]| and /i).map(f => f.trim().toLowerCase()).filter(Boolean);
}

export function parseInfiniteCampus(text: string, knownClasses: string[] = []): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const parsed: (ImportedItem | { skipped: SkippedLine })[] = [];
  let lastItem: ImportedItem | null = null;
  let pendingDate: string | null = null;

  for (const line of lines) {
    if (isDateOnly(line)) {
      // A stamp on its own line belongs to the notification just above it, unless that one already has a date —
      // then it's a header for the next one.
      if (lastItem && !lastItem.date) lastItem.date = findDate(line);
      else pendingDate = findDate(line);
      continue;
    }

    const { message, date: inlineDate } = splitStamp(line);
    let item: ImportedItem | null = null;
    const score = message.match(SCORE);
    const flagged = !score && message.match(FLAGGED);
    if (score) {
      const [, , earnedS, possibleS, rest, flagText] = score;
      const split = splitTitleAndClass(rest, knownClasses);
      const flags = parseFlags(flagText);
      const earned = Number(earnedS), possible = Number(possibleS);
      if (!split) { parsed.push({ skipped: { raw: line, reason: "Couldn't tell the assignment name from the class" } }); continue; }
      if (flags.includes("dropped")) { parsed.push({ skipped: { raw: line, reason: "Dropped in Campus (doesn't count)" } }); continue; }
      if (!Number.isFinite(earned) || !Number.isFinite(possible) || possible <= 0) {
        parsed.push({ skipped: { raw: line, reason: "Out of 0 points (extra credit?) — enter it by hand if it should count" } });
        continue;
      }
      item = {
        ...split, status: "graded", grade: Math.max(0, Math.round((earned / possible) * 100)),
        points: { earned, possible }, flags, date: null, raw: line,
      };
    } else if (flagged) {
      const [, , rest, flagText] = flagged;
      const split = splitTitleAndClass(rest, knownClasses);
      const flags = parseFlags(flagText);
      if (!split) { parsed.push({ skipped: { raw: line, reason: "Couldn't tell the assignment name from the class" } }); continue; }
      if (flags.includes("dropped")) { parsed.push({ skipped: { raw: line, reason: "Dropped in Campus (doesn't count)" } }); continue; }
      if (!flags.includes("missing")) continue; // e.g. a Late flag on its own — the score notification carries the grade
      item = { ...split, status: "missing", grade: null, points: null, flags: flags.filter(f => f !== "missing"), date: null, raw: line };
    } else {
      continue; // noise: semester grades, attendance, headings
    }

    item.date = inlineDate ?? pendingDate;
    pendingDate = null;
    lastItem = item;
    parsed.push(item);
  }

  // Newest wins for a re-scored item. With dates, latest date; without, Campus lists newest first, so the first seen.
  const items: ImportedItem[] = [];
  const skipped: SkippedLine[] = [];
  const byKey = new Map<string, ImportedItem>();
  for (const p of parsed) {
    if ("skipped" in p) { skipped.push(p.skipped); continue; }
    const key = importKey(p.className, p.title);
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, p); items.push(p); continue; }
    if (p.date && prev.date && p.date > prev.date) {
      items[items.indexOf(prev)] = p;
      byKey.set(key, p);
    }
  }
  return { items, skipped };
}

export const infiniteCampus: GradeSource = {
  id: "infinite-campus",
  name: "Infinite Campus",
  instructions:
    "In the Campus Parent portal, open Notifications, select the whole list, copy it, and paste it below. " +
    "Score and Missing notifications are read; everything else is ignored.",
  parse: parseInfiniteCampus,
};
