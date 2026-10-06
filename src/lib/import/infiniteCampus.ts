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

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysBefore = (now: Date, n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);

/** A month/day with no year: this year, unless that's still in the future (then it was last year). */
function withYear(month: number, day: number, now: Date): string {
  const y = now.getFullYear();
  const candidate = new Date(y, month - 1, day);
  return ymd(candidate > now ? new Date(y - 1, month - 1, day) : candidate);
}

/**
 * Finds a date in a line and returns YYYY-MM-DD, or null. Understands 9/21/2026, 9/21/26, 2026-09-21,
 * "Sep 21, 2026", and — relative to `now` — "Today", "Yesterday", a weekday name ("Friday" = the most recent one),
 * 9/21 and "Sep 21" with no year.
 */
export function findDate(line: string, now: Date = new Date()): string | null {
  if (/^\s*today\b/i.test(line)) return ymd(now);
  if (/^\s*yesterday\b/i.test(line)) return ymd(daysBefore(now, 1));
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
  m = line.match(/^\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(\d{1,2})\/(\d{1,2})\b(?!\/)/i);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 31) return withYear(Number(m[1]), Number(m[2]), now);
  m = line.match(/^\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i);
  if (m) return withYear(MONTHS.indexOf(m[1].toLowerCase()) + 1, Number(m[2]), now);
  m = line.match(/^\s*(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i);
  if (m) {
    const back = (now.getDay() - WEEKDAYS.indexOf(m[1].toLowerCase()) + 7) % 7;
    return ymd(daysBefore(now, back));
  }
  return null;
}

const DAY = String.raw`(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*`;
const MON = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?`;
const TIME = String.raw`(?:,?\s*(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)`;
// A whole stamp: an absolute date (optionally after a weekday), a relative day, or a bare weekday — each with an optional time.
const STAMP = String.raw`(?:(?:${DAY},?\s+)?(?:\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}(?:/\d{2,4})?|${MON}\s+\d{1,2}(?:,?\s+\d{4})?)${TIME}?|(?:today|yesterday|${DAY})${TIME}?)`;
const LEADING_STAMP = new RegExp(`^${STAMP}\\s*[-–|:]?\\s*`, "i");
const TRAILING_STAMP = new RegExp(`\\s*[-–|]?\\s*${STAMP}$`, "i");

/** Pull a date/time stamp off either end of a notification line: returns the bare message and the stamp's date. */
export function splitStamp(line: string, now: Date = new Date()): { message: string; date: string | null } {
  const lead = line.match(LEADING_STAMP);
  if (lead) {
    const date = findDate(lead[0], now);
    if (date) return { message: line.slice(lead[0].length).trim(), date };
  }
  const trail = line.match(TRAILING_STAMP);
  if (trail) {
    const date = findDate(trail[0].replace(/^[\s\-–|]+/, ""), now);
    if (date) return { message: line.slice(0, trail.index).trim(), date };
  }
  return { message: line, date: null };
}

/** A line that is only a date/time stamp (how dates often land when a list is copied out of a page). */
function isDateOnly(line: string, now: Date): boolean {
  const { message, date } = splitStamp(line, now);
  return date !== null && message.replace(/[\s,.\-–|]/g, "") === "";
}

/** Campus adds the term to class names ("Biology -S1", "Geometry - S2", "Art -Q3"); the app stores the plain name. */
export function stripTerm(className: string): string {
  return className.replace(/\s*-\s*(?:s|q|t|sem|semester|quarter|term)\s*\d\s*$/i, "").trim();
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
    const cls = known.get(normalize(stripTerm(text.slice(i + 4))));
    if (cls && text.slice(0, i).trim()) return { title: text.slice(0, i).trim(), className: cls };
  }
  const idx = positions[positions.length - 1];
  if (idx === undefined) return null;
  const title = text.slice(0, idx).trim();
  const className = stripTerm(text.slice(idx + 4));
  return title && className ? { title, className } : null;
}

function parseFlags(s: string | undefined): string[] {
  return (s ?? "").split(/[,/]| and /i).map(f => f.trim().toLowerCase()).filter(Boolean);
}

export function parseInfiniteCampus(text: string, knownClasses: string[] = [], now: Date = new Date()): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const parsed: (ImportedItem | { skipped: SkippedLine })[] = [];
  let lastItem: ImportedItem | null = null;
  let pendingDate: string | null = null;

  for (const line of lines) {
    if (isDateOnly(line, now)) {
      // A stamp on its own line belongs to the notification just above it, unless that one already has a date —
      // then it's a header for the next one.
      const date = splitStamp(line, now).date;
      if (lastItem && !lastItem.date) lastItem.date = date;
      else pendingDate = date;
      continue;
    }

    const { message, date: inlineDate } = splitStamp(line, now);
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
    "In Campus, open the notifications (the bell) and take screenshots of the list — scroll and take more if it's long. " +
    "Score and Missing notifications are read; attendance and semester grades are ignored.",
  parse: parseInfiniteCampus,
};
