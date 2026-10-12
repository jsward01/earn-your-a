import { infiniteCampus } from "./infiniteCampus";
import type { GradeSource, ParseResult } from "./types";

/** Every school system with a dedicated parser. Anything else is read by Claude (AI). */
export const GRADE_SOURCES: GradeSource[] = [infiniteCampus];

/**
 * Which dedicated parser, if any, recognizes the pasted text: the first one that finds at least one item. `null`
 * means none did, so the text should go to the AI reader.
 */
export function detectFormat(text: string, knownClasses: string[], now?: Date): { source: GradeSource; result: ParseResult } | null {
  for (const source of GRADE_SOURCES) {
    const result = source.parse(text, knownClasses, now);
    if (result.items.length > 0) return { source, result };
  }
  return null;
}
