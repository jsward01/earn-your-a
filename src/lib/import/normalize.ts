/** Lowercase, straighten quotes, and collapse punctuation/whitespace so "Concept check 2.1" matches "Concept Check 2.1". */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9#%&'/.:\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Identity of an imported item: same class + same title (normalized). */
export function importKey(className: string, title: string): string {
  return `${normalize(className)}\u0000${normalize(title)}`;
}

/** Campus adds the term to class names ("Biology -S1", "Geometry - S2", "Art -Q3"); the app stores the plain name. */
export function stripTerm(className: string): string {
  return className.replace(/\s*-\s*(?:s|q|t|sem|semester|quarter|term)\s*\d\s*$/i, "").trim();
}
