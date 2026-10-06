/**
 * Grade imports: each school system gets one `GradeSource` that turns pasted text into `ImportedItem`s. Everything
 * after parsing (matching to existing work, the review checklist, saving) is shared, so adding a system is one file
 * plus a line in `sources.ts`.
 */

export interface ImportedItem {
  /** The class as the school system names it, e.g. "Geometry" — stored as the assignment's subject. */
  className: string;
  title: string;
  /** "pending" = listed with no score yet (upcoming or not graded). */
  status: "graded" | "missing" | "pending";
  /** Percent, rounded; null when missing or pending. */
  grade: number | null;
  /** The raw score, for display ("8 / 10"). */
  points: { earned: number; possible: number } | null;
  /** Lowercased flags the system attached ("late", "incomplete", ...). "dropped" items never reach this list. */
  flags: string[];
  /** YYYY-MM-DD: the real due date (`dueDateExact`) or the notification's date, used as an approximate due date for new work. */
  date: string | null;
  /** True when `date` is the school's due date (assignment lists), false when it's just when a notification arrived. */
  dueDateExact: boolean;
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
  /**
   * True when the paste is a full list of the student's work (e.g. a Campus Assignments page), so anything in the app
   * that isn't in it is worth a look. False for feeds that only show recent changes (notifications).
   */
  complete: boolean;
}

/** One assignment as the AI reader returns it (functions/api/import/extract.ts → ExtractSchema). */
export interface ExtractedItem {
  className: string;
  title: string;
  status: "graded" | "missing" | "pending" | "dropped" | "exempt";
  pointsEarned: number | null;
  pointsPossible: number | null;
  percent: number | null;
  dueDate: string | null;
  flags: string[];
}

interface SourceInfo {
  id: string;
  name: string;
  /** Where to copy from, in plain words, shown above the paste box. */
  instructions: string;
}

/**
 * How a school system's paste becomes items. "local": a parser written for that system's exact layout (instant,
 * free). "ai": Claude reads any layout, text or screenshots (a few seconds, costs a little per import).
 */
export type GradeSource =
  | (SourceInfo & {
      kind: "local";
      /** `knownClasses` (subjects already in the app) helps split "NAME in CLASS" when a title itself contains " in ". */
      parse(text: string, knownClasses: string[], now?: Date): ParseResult;
    })
  | (SourceInfo & { kind: "ai" });
