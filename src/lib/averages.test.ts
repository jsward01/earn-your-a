import { describe, expect, it } from "vitest";
import type { Assignment } from "../types";
import { classAverages, periodStart, schoolYearStart } from "./averages";

let n = 0;
const a = (p: Partial<Assignment>): Assignment => ({
  id: `a${n++}`, title: "HW", subject: "Geometry", type: "assignment", dueDate: "2026-09-15",
  status: "graded", grade: 90, daysLeft: null, ...p,
});

describe("classAverages", () => {
  it("averages each class separately, sorted by name", () => {
    const res = classAverages([
      a({ subject: "Geometry", grade: 80 }), a({ subject: "Geometry", grade: 91 }), a({ subject: "Biology", grade: 70 }),
    ], "2026-07-01");
    expect(res).toEqual([
      { subject: "Biology", average: 70, graded: 1, missing: 0 },
      { subject: "Geometry", average: 86, graded: 2, missing: 0 },
    ]);
  });

  it("counts missing work as 0", () => {
    const [geo] = classAverages([a({ grade: 100 }), a({ status: "missing", grade: null })], "2026-07-01");
    expect(geo).toEqual({ subject: "Geometry", average: 50, graded: 1, missing: 1 });
  });

  it("leaves out pending work and anything due before the period", () => {
    const res = classAverages([
      a({ status: "pending", grade: null }), a({ dueDate: "2026-06-30", grade: 10 }), a({ grade: 88 }),
    ], "2026-07-01");
    expect(res).toEqual([{ subject: "Geometry", average: 88, graded: 1, missing: 0 }]);
  });

  it("includes history work (it's still a real grade)", () => {
    expect(classAverages([a({ historyOnly: true, grade: 60 })], "2026-07-01")[0].average).toBe(60);
  });

  it("returns nothing when no work is graded or missing", () => {
    expect(classAverages([a({ status: "pending", grade: null })], "2026-07-01")).toEqual([]);
  });
});

describe("periods", () => {
  it("school year starts July 1, including for spring dates", () => {
    expect(schoolYearStart(new Date(2026, 9, 11))).toBe("2026-07-01");
    expect(schoolYearStart(new Date(2027, 2, 1))).toBe("2026-07-01");
    expect(schoolYearStart(new Date(2026, 6, 1))).toBe("2026-07-01");
  });

  it("recent = the last 28 days", () => {
    expect(periodStart("recent", new Date(2026, 9, 11))).toBe("2026-09-13");
  });
});
