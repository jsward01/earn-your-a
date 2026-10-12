import { describe, expect, it } from "vitest";
import { MAX_EMAIL_LENGTH, defaultEmailAlertSettings, fromRow, isEmailAddress, validateEmailAlertSettings } from "./notificationSettings";

const valid = { email: true, emailAddr: "parent@example.com", due1day: true, dueToday: false, makeup: true, payout: false };

describe("isEmailAddress", () => {
  it("accepts ordinary addresses", () => {
    for (const a of ["a@b.co", "first.last+tag@school.example.org"]) expect(isEmailAddress(a)).toBe(true);
  });

  it("rejects things that aren't addresses", () => {
    for (const a of ["", "susana", "a@b", "@b.com", "a@.com x", "a b@c.com", "a@@b.com"]) expect(isEmailAddress(a)).toBe(false);
  });

  it("enforces the length limit", () => {
    const local = "a".repeat(MAX_EMAIL_LENGTH - "@b.co".length);
    expect(isEmailAddress(`${local}@b.co`)).toBe(true);
    expect(isEmailAddress(`a${local}@b.co`)).toBe(false);
  });
});

describe("defaultEmailAlertSettings", () => {
  it("starts with email off and every alert type on", () => {
    expect(defaultEmailAlertSettings("parent@example.com")).toEqual({
      email: false, emailAddr: "parent@example.com", due1day: true, dueToday: true, makeup: true, payout: true,
    });
  });

  it("leaves the address blank when the login isn't an email address", () => {
    expect(defaultEmailAlertSettings("susana").emailAddr).toBe("");
  });
});

describe("fromRow", () => {
  it("maps 0/1 columns to booleans and a null address to blank", () => {
    expect(fromRow({ email: 1, email_addr: null, due_1day: 0, due_today: 1, makeup: 0, payout: 1 })).toEqual({
      email: true, emailAddr: "", due1day: false, dueToday: true, makeup: false, payout: true,
    });
  });
});

describe("validateEmailAlertSettings", () => {
  it("accepts a full valid request", () => {
    expect(validateEmailAlertSettings(valid)).toEqual(valid);
  });

  it("trims and lowercases the address", () => {
    expect(validateEmailAlertSettings({ ...valid, emailAddr: "  Parent@Example.COM " })).toEqual(valid);
  });

  it("requires an address to turn email on", () => {
    expect(validateEmailAlertSettings({ ...valid, emailAddr: "" })).toHaveProperty("error");
    expect(validateEmailAlertSettings({ ...valid, emailAddr: undefined })).toHaveProperty("error");
  });

  it("allows email off with or without an address", () => {
    expect(validateEmailAlertSettings({ ...valid, email: false, emailAddr: "" })).toEqual({ ...valid, email: false, emailAddr: "" });
    expect(validateEmailAlertSettings({ ...valid, email: false })).toEqual({ ...valid, email: false });
  });

  it("rejects a bad address even with email off", () => {
    expect(validateEmailAlertSettings({ ...valid, email: false, emailAddr: "not-an-email" })).toHaveProperty("error");
    expect(validateEmailAlertSettings({ ...valid, emailAddr: 42 })).toHaveProperty("error");
  });

  it("rejects missing or non-boolean switches", () => {
    for (const key of ["email", "due1day", "dueToday", "makeup", "payout"]) {
      expect(validateEmailAlertSettings({ ...valid, [key]: undefined })).toHaveProperty("error");
      expect(validateEmailAlertSettings({ ...valid, [key]: 1 })).toHaveProperty("error");
    }
  });

  it("rejects a missing body", () => {
    expect(validateEmailAlertSettings(null)).toHaveProperty("error");
  });
});
