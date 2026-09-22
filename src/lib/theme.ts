/**
 * Light / Dark / Auto appearance. Which one is a per-device preference (a phone can be dark while the laptop is
 * light), so it lives in localStorage rather than the database. "system" follows the OS setting, including when the
 * OS flips at sunset. index.html applies the saved choice before the page paints, so there is no white flash.
 */
export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "system" || v === "light" || v === "dark";
}

/** What actually gets painted for a choice, given whether the OS currently prefers dark. */
export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === "system") return systemPrefersDark ? "dark" : "light";
  return choice;
}

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(v) ? v : "system";
  } catch {
    return "system"; // storage blocked (private window etc.): follow the system
  }
}

const systemQuery = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice, systemQuery()?.matches ?? false);
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

export function setThemeChoice(choice: ThemeChoice): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, choice); } catch { /* per-device convenience only */ }
  applyTheme(choice);
}

/** Call once at startup: applies the saved choice and keeps "Auto" in step with the OS. */
export function initTheme(): void {
  applyTheme(getThemeChoice());
  systemQuery()?.addEventListener("change", () => {
    if (getThemeChoice() === "system") applyTheme("system");
  });
}
