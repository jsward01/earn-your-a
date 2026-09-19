import { describe, expect, it } from "vitest";
import { nextMakeupState } from "./assignments";

const NOW = new Date("2026-03-10T12:00:00Z"); // noon UTC: same calendar day in every timezone the app could run in
const DAYS = 7;
const open = (deadline: string | null) => ({ deadline });

describe("nextMakeupState — the 1-week makeup window", () => {
  describe("opening the window", () => {
    it("a failing test opens a window N days out", () => {
      expect(nextMakeupState(open(null), "graded", 50, 70, DAYS, NOW)).toEqual({ deadline: "2026-03-17", used: 0 });
    });

    it("missing work opens a window too", () => {
      expect(nextMakeupState(open(null), "missing", null, 70, DAYS, NOW)).toEqual({ deadline: "2026-03-17", used: 0 });
    });

    it("honors the configured window length", () => {
      expect(nextMakeupState(open(null), "graded", 50, 70, 14, NOW).deadline).toBe("2026-03-24");
      expect(nextMakeupState(open(null), "graded", 50, 70, 1, NOW).deadline).toBe("2026-03-11");
    });

    it("rolls over month boundaries", () => {
      expect(nextMakeupState(open(null), "graded", 0, 70, DAYS, new Date("2026-03-28T12:00:00Z")).deadline).toBe("2026-04-04");
    });

    it("69 opens a window but 70 does not (threshold is inclusive)", () => {
      expect(nextMakeupState(open(null), "graded", 69, 70, DAYS, NOW).deadline).toBe("2026-03-17");
      expect(nextMakeupState(open(null), "graded", 70, 70, DAYS, NOW).deadline).toBeNull();
    });

    it("respects a custom passing threshold", () => {
      expect(nextMakeupState(open(null), "graded", 75, 80, DAYS, NOW).deadline).toBe("2026-03-17");
      expect(nextMakeupState(open(null), "graded", 80, 80, DAYS, NOW).deadline).toBeNull();
    });
  });

  describe("no window when nothing is wrong", () => {
    it("pending work", () => {
      expect(nextMakeupState(open(null), "pending", null, 70, DAYS, NOW)).toEqual({ deadline: null, used: 0 });
    });

    it("a first-time pass never touches makeup", () => {
      expect(nextMakeupState(open(null), "graded", 95, 70, DAYS, NOW)).toEqual({ deadline: null, used: 0 });
    });

    it("graded with no grade entered", () => {
      expect(nextMakeupState(open(null), "graded", null, 70, DAYS, NOW)).toEqual({ deadline: null, used: 0 });
    });
  });

  describe("the deadline is fixed once opened", () => {
    it("re-grading another failing score does not push the deadline out", () => {
      const later = new Date("2026-03-14T12:00:00Z");
      expect(nextMakeupState(open("2026-03-17"), "graded", 40, 70, DAYS, later)).toEqual({ deadline: "2026-03-17", used: 0 });
    });

    it("missing -> failing grade keeps the original deadline", () => {
      expect(nextMakeupState(open("2026-03-17"), "graded", 55, 70, DAYS, NOW).deadline).toBe("2026-03-17");
    });

    it("failing -> missing keeps the original deadline", () => {
      expect(nextMakeupState(open("2026-03-17"), "missing", null, 70, DAYS, NOW).deadline).toBe("2026-03-17");
    });
  });

  describe("passing a retake", () => {
    it("clears the deadline and marks the makeup as used", () => {
      expect(nextMakeupState(open("2026-03-17"), "graded", 85, 70, DAYS, NOW)).toEqual({ deadline: null, used: 1 });
    });

    it("exactly at the threshold counts as passing", () => {
      expect(nextMakeupState(open("2026-03-17"), "graded", 70, 70, DAYS, NOW)).toEqual({ deadline: null, used: 1 });
    });

    // QUIRK (documented, not endorsed): `used` is computed from the deadline on the row being edited, and a
    // passed retake has already cleared it. So the next save of that same assignment (even just a title
    // change) recomputes used = 0, and the "makeup used" flag is lost.
    it("loses the 'used' flag on the next edit after a passed retake", () => {
      const afterPass = nextMakeupState(open("2026-03-17"), "graded", 85, 70, DAYS, NOW);
      expect(afterPass.used).toBe(1);
      expect(nextMakeupState({ deadline: afterPass.deadline }, "graded", 85, 70, DAYS, NOW).used).toBe(0);
    });
  });

  it("failing again after a pass opens a brand-new window (no lock-in tracking today)", () => {
    // Pass clears the deadline; a later failing edit therefore starts a fresh window from 'now'.
    const afterPass = nextMakeupState(open("2026-03-17"), "graded", 85, 70, DAYS, NOW);
    const failedAgain = nextMakeupState(afterPass, "graded", 40, 70, DAYS, new Date("2026-03-12T12:00:00Z"));
    expect(failedAgain.deadline).toBe("2026-03-19");
  });

  // "After 1 week the penalty locks in permanently" is now enforced by payouts, not by this function: paying out
  // archives finished work (except items whose makeup window is still open) and archived work can't be edited.
  // See ARCHIVE_ON_PAYOUT_WHERE in assignments.ts and the payout-archive checks in CLAUDE.md.
});
