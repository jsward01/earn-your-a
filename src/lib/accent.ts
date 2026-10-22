/**
 * Accent color: each person picks the color of their own app, saved on their account (`users.accent`). The app is
 * styled with one accent scale per role (students indigo, parents emerald); src/index.css re-points that scale at the
 * chosen palette from two attributes on <html>: data-accent-src (the role's scale) and data-accent (the choice).
 * The last choice is also cached on the device so index.html can apply it before the first paint.
 */
import type { Role } from "../types";

export const ACCENTS = [
  { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { id: "blue", label: "Blue", swatch: "#2563eb" },
  { id: "violet", label: "Purple", swatch: "#7c3aed" },
  { id: "pink", label: "Pink", swatch: "#be185d" },
  { id: "red", label: "Red", swatch: "#dc2626" },
  { id: "orange", label: "Orange", swatch: "#c2410c" },
  { id: "green", label: "Green", swatch: "#15803d" },
  { id: "emerald", label: "Teal green", swatch: "#047857" },
] as const;

export type Accent = (typeof ACCENTS)[number]["id"];

const CACHE_KEY = "accent";

/** The scale a role's screens are written in, which is also that role's default color. */
export function defaultAccent(role: Role): Accent {
  return role === "parent" ? "emerald" : "indigo";
}

export function isAccent(v: unknown): v is Accent {
  return ACCENTS.some(a => a.id === v);
}

/** Paint the app in `accent` (null = the role's default), and remember it on this device for the next page load. */
export function applyAccent(role: Role | null, accent: string | null): void {
  const root = document.documentElement;
  if (!role) {
    delete root.dataset.accentSrc;
    delete root.dataset.accent;
    try { localStorage.removeItem(CACHE_KEY); } catch { /* cache only */ }
    return;
  }
  const src = defaultAccent(role);
  const chosen = isAccent(accent) ? accent : src;
  root.dataset.accentSrc = src;
  root.dataset.accent = chosen;
  try { localStorage.setItem(CACHE_KEY, `${src}:${chosen}`); } catch { /* cache only */ }
}
