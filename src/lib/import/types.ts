/**
 * Grade imports: each school system gets one `GradeSource` that turns pasted text into `ImportedItem`s. Everything
 * after parsing (matching to existing work, the review checklist, saving) is shared, so adding a system is one file
 * plus a line in `sources.ts`.
 */

export interface ImportedItem {
  /** The class as the school system names it, e.g. "Geometry" — stored as the assignment's subject. */
  className: string;
  title: string;
  status: "graded" | "missing";
  /** Percent, rounded; null when missing. */
  grade: number | null;
  /** The raw score, for display ("8 / 10"). */
  points: { earned: number; possible: number } | null;
  /** Lowercased flags the system attached ("late", "incomplete", ...). "dropped" items never reach this list. */
  flags: string[];
  /** YYYY-MM-DD of the notification when the paste includes one; used as an approximate due date for new work. */
  date: string | null;
  /** The text this came from, shown on the checklist so a parent can sanity-check it. */
  raw: string;
}

export interface SkippedLine {
  raw: string;
  reason: string;
}

export interface ParseResult {
  /** Newest first, one per class + title (a re-scored item keeps only its newest score). */
  items: ImportedItem[];
  /** Lines that looked like grade notifications but were skipped on purpose (dropped, no points possible, ...). */
  skipped: SkippedLine[];
}

export interface GradeSource {
  id: string;
  name: string;
  /** Where to copy from, in plain words, shown above the paste box. */
  instructions: string;
  /** `knownClasses` (subjects already in the app) helps split "NAME in CLASS" when a title itself contains " in ". */
  parse(text: string, knownClasses: string[]): ParseResult;
}
