import { describe, expect, it } from "vitest";
import { cleanChecked } from "./aiPlans";

describe("cleanChecked", () => {
  it("keeps valid step numbers once each, in order", () => {
    expect(cleanChecked([2, 0, 2], 3)).toEqual([0, 2]);
    expect(cleanChecked([], 3)).toEqual([]);
  });

  it("rejects anything that isn't a list of steps in the plan", () => {
    expect(cleanChecked("0,1", 3)).toBeNull();
    expect(cleanChecked([3], 3)).toBeNull();
    expect(cleanChecked([-1], 3)).toBeNull();
    expect(cleanChecked([1.5], 3)).toBeNull();
    expect(cleanChecked(["1"], 3)).toBeNull();
  });
});
