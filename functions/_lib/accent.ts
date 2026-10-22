/** Accent colors a person can pick for their own app. Keep in step with src/lib/accent.ts and the CSS in src/index.css. */
export const ACCENTS = ["indigo", "blue", "violet", "pink", "red", "orange", "green", "emerald"] as const;
export type Accent = (typeof ACCENTS)[number];

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}
