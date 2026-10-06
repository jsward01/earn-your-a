import { describe, expect, it } from "vitest";
import { MAX_ADJUSTMENT, MAX_REASON_LENGTH, validateAdjustment } from "./adjustments";

describe("validateAdjustment", () => {
  it("accepts positive and negative amounts with a reason", () => {
    expect(validateAdjustment({ amount: 5, reason: "Bonus for chores" })).toEqual({ amount: 5, reason: "Bonus for chores" });
    expect(validateAdjustment({ amount: -20, reason: "Test regraded" })).toEqual({ amount: -20, reason: "Test regraded" });
  });

  it("rounds to cents and trims the reason", () => {
    expect(validateAdjustment({ amount: 2.005, reason: "  fix  " })).toEqual({ amount: 2.01, reason: "fix" });
    expect(validateAdjustment({ amount: 0.1 + 0.2, reason: "x" })).toEqual({ amount: 0.3, reason: "x" });
  });

  it("rejects zero, non-numbers, and amounts that round to zero", () => {
    for (const amount of [0, 0.001, "5", null, undefined, NaN, Infinity]) {
      expect(validateAdjustment({ amount, reason: "x" })).toHaveProperty("error");
    }
  });

  it("enforces the size limit both ways", () => {
    expect(validateAdjustment({ amount: MAX_ADJUSTMENT, reason: "x" })).not.toHaveProperty("error");
    expect(validateAdjustment({ amount: -MAX_ADJUSTMENT, reason: "x" })).not.toHaveProperty("error");
    expect(validateAdjustment({ amount: MAX_ADJUSTMENT + 1, reason: "x" })).toHaveProperty("error");
    expect(validateAdjustment({ amount: -MAX_ADJUSTMENT - 1, reason: "x" })).toHaveProperty("error");
  });

  it("requires a reason of sensible length", () => {
    expect(validateAdjustment({ amount: 1 })).toHaveProperty("error");
    expect(validateAdjustment({ amount: 1, reason: "   " })).toHaveProperty("error");
    expect(validateAdjustment({ amount: 1, reason: 7 })).toHaveProperty("error");
    expect(validateAdjustment({ amount: 1, reason: "a".repeat(MAX_REASON_LENGTH) })).not.toHaveProperty("error");
    expect(validateAdjustment({ amount: 1, reason: "a".repeat(MAX_REASON_LENGTH + 1) })).toHaveProperty("error");
  });

  it("handles a missing body", () => {
    expect(validateAdjustment(null)).toHaveProperty("error");
    expect(validateAdjustment(undefined)).toHaveProperty("error");
  });
});
