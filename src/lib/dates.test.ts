import { describe, expect, it } from "vitest";
import { daysUntilDate } from "./dates";

// Local-time constructors on purpose: the bug this guards against only shows up late in the local day.
const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h, 0, 0);

describe("daysUntilDate", () => {
  it("counts calendar days from local midnight", () => {
    expect(daysUntilDate("2026-09-21", at(2026, 9, 21, 8))).toBe(0);
    expect(daysUntilDate("2026-09-22", at(2026, 9, 21, 8))).toBe(1);
    expect(daysUntilDate("2026-09-24", at(2026, 9, 21, 8))).toBe(3);
  });

  it("gives the same answer at 12:01am and 11:59pm (evening must not flip 'tomorrow' to 'today')", () => {
    for (const hour of [0, 6, 12, 18, 19, 23]) {
      expect(daysUntilDate("2026-09-22", at(2026, 9, 21, hour))).toBe(1);
      expect(daysUntilDate("2026-09-21", at(2026, 9, 21, hour))).toBe(0);
      expect(daysUntilDate("2026-09-20", at(2026, 9, 21, hour))).toBe(-1);
    }
  });

  it("is negative once the day has passed", () => {
    expect(daysUntilDate("2026-09-14", at(2026, 9, 21, 15))).toBe(-7);
  });

  it("handles month boundaries", () => {
    expect(daysUntilDate("2026-10-01", at(2026, 9, 30, 22))).toBe(1);
  });
});
