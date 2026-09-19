import { describe, expect, it } from "vitest";
import {
  affectsLedger, checkStudentCreate, checkStudentDelete, checkStudentEdit, diffFields, gradeError, isIsoDate, summarizeChanges, type Fields,
} from "./assignmentEdits";

const BASE: Fields = { title: "Unit Test", subject: "Math", type: "test", dueDate: "2026-03-10", status: "graded", grade: 62 };

describe("diffFields / summarizeChanges", () => {
  it("no differences -> empty", () => {
    expect(diffFields(BASE, { ...BASE })).toEqual({});
  });

  it("reports only what changed, with from/to", () => {
    const c = diffFields(BASE, { ...BASE, grade: 91, status: "graded", title: "Unit Test 2" });
    expect(Object.keys(c).sort()).toEqual(["grade", "title"]);
    expect(c.grade).toEqual({ from: 62, to: 91 });
  });

  it("summary is human-readable, in a stable field order", () => {
    const c = diffFields({ ...BASE, status: "pending", grade: null }, { ...BASE, status: "graded", grade: 91 });
    expect(summarizeChanges(c)).toBe("Status pending → graded · Grade none → 91%");
  });

  it("titles are quoted so a rename is unambiguous", () => {
    expect(summarizeChanges(diffFields(BASE, { ...BASE, title: "Final" }))).toBe('Title "Unit Test" → "Final"');
  });

  it("a grade of 0 is a real value, not 'none'", () => {
    expect(summarizeChanges(diffFields(BASE, { ...BASE, grade: 0 }))).toBe("Grade 62% → 0%");
  });
});

describe("affectsLedger — only type, status, and grade move money", () => {
  it.each([["type", { type: "quiz" }], ["status", { status: "missing" }], ["grade", { grade: 90 }]] as const)("%s does", (_k, patch) => {
    expect(affectsLedger(diffFields(BASE, { ...BASE, ...patch } as Fields))).toBe(true);
  });

  it.each([["title", { title: "X" }], ["subject", { subject: "Art" }], ["dueDate", { dueDate: "2026-04-01" }]] as const)("%s does not", (_k, patch) => {
    expect(affectsLedger(diffFields(BASE, { ...BASE, ...patch } as Fields))).toBe(false);
  });

  it("an unchanged save does not", () => {
    expect(affectsLedger(diffFields(BASE, { ...BASE }))).toBe(false);
  });
});

describe("students can't grade", () => {
  describe("creating", () => {
    it.each([{}, { status: "pending" }, { status: "pending", grade: null }])("plain pending work is fine: %j", body => {
      expect(checkStudentCreate(body).ok).toBe(true);
    });

    it.each([{ status: "graded" }, { status: "missing" }, { grade: 100 }, { grade: 0 }, { status: "graded", grade: 100 }])("refused: %j", body => {
      expect(checkStudentCreate(body).ok).toBe(false);
    });
  });

  describe("editing", () => {
    it("can change details of pending work", () => {
      expect(checkStudentEdit("pending", {}).ok).toBe(true);
      expect(checkStudentEdit("pending", { status: "pending", grade: null }).ok).toBe(true);
    });

    it.each(["graded", "missing"])("can't touch %s work at all", status => {
      expect(checkStudentEdit(status, {}).ok).toBe(false);
    });

    it.each([{ status: "graded" }, { status: "missing" }, { grade: 100 }, { grade: 0 }])("can't set status/grade on pending work: %j", body => {
      expect(checkStudentEdit("pending", body).ok).toBe(false);
    });

    it("the error tells them why", () => {
      const v = checkStudentEdit("graded", {});
      expect(!v.ok && v.error).toMatch(/parent/i);
    });
  });

  describe("deleting", () => {
    it("pending is fine", () => expect(checkStudentDelete("pending").ok).toBe(true));
    it.each(["graded", "missing"])("%s is not (it would erase a penalty or reward)", status => {
      expect(checkStudentDelete(status).ok).toBe(false);
    });
  });
});

describe("input validation", () => {
  it.each([null, undefined, 0, 70, 100, 105.5, 200])("grade %s ok", g => expect(gradeError(g)).toBeNull());
  it.each([-1, 201, NaN, Infinity, "90", {}])("grade %s rejected", g => expect(gradeError(g)).not.toBeNull());
  it.each(["2026-03-10", "1999-12-31"])("date %s ok", d => expect(isIsoDate(d)).toBe(true));
  it.each(["03/10/2026", "2026-3-1", "", "2026-03-10T00:00", null, 20260310])("date %s rejected", d => expect(isIsoDate(d)).toBe(false));
});
