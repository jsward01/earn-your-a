import { describe, expect, it } from "vitest";
import { isThemeChoice, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("Light and Dark ignore the system setting", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("Auto follows the system setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("isThemeChoice", () => {
  it("accepts only the three known choices (a corrupt stored value falls back to Auto)", () => {
    for (const ok of ["system", "light", "dark"]) expect(isThemeChoice(ok)).toBe(true);
    for (const bad of ["", "Dark", "auto", null, undefined, 1]) expect(isThemeChoice(bad)).toBe(false);
  });
});
