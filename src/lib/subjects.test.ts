import { describe, expect, it } from "vitest";
import { subjectOptions } from "./subjects";
import { SUBJECTS } from "../data/mockData";

describe("subjectOptions", () => {
  it("lists the student's classes once each, A–Z", () => {
    const list = subjectOptions([
      { subject: "Geometry" }, { subject: "CE / Computer Tech I A+" }, { subject: "Geometry" }, { subject: " Biology " },
    ]);
    expect(list).toEqual(["Biology", "CE / Computer Tech I A+", "Geometry"]);
  });

  it("falls back to the generic list when there's no work yet", () => {
    expect(subjectOptions([])).toEqual(SUBJECTS);
    expect(subjectOptions([{ subject: "  " }])).toEqual(SUBJECTS);
  });
});
