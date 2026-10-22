import { describe, expect, it } from "vitest";
import {
  MAX_EMAIL_LENGTH,
  defaultEmailAlertSettings,
  fromRow,
  isEmailAddress,
  quietHoursFromRow,
  quietHoursToRow,
  validateEmailAlertSettings,
} from "./notificationSettings";

const valid = {
  email: true, emailAddr: "parent@example.com", due1day: true, dueToday: false, makeup: true, payout: false, messages: true,
  quietHours: true, quietStart: 21, quietEnd: 7,
};
const DEFAULT_QUIET = { quietHours: true, quietStart: 20, quietEnd: 6 };

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
      email: false, emailAddr: "parent@example.com", due1day: true, dueToday: true, makeup: true, payout: true, messages: true, ...DEFAULT_QUIET,
    });
  });

  it("leaves the address blank when the login isn't an email address", () => {
    expect(defaultEmailAlertSettings("susana").emailAddr).toBe("");
  });
});

describe("fromRow", () => {
  it("maps 0/1 columns to booleans and a null address to blank", () => {
    expect(fromRow({ email: 1, email_addr: null, due_1day: 0, due_today: 1, makeup: 0, payout: 1, messages: 0, quiet_start: null, quiet_end: null })).toEqual({
      email: true, emailAddr: "", due1day: false, dueToday: true, makeup: false, payout: true, messages: false, ...DEFAULT_QUIET,
    });
  });

  it("reads saved quiet hours, and empty strings as off", () => {
    const base = { email: 1, email_addr: null, due_1day: 1, due_today: 1, makeup: 1, payout: 1, messages: 1 };
    expect(fromRow({ ...base, quiet_start: "22:00", quiet_end: "05:00" })).toMatchObject({ quietHours: true, quietStart: 22, quietEnd: 5 });
    expect(fromRow({ ...base, quiet_start: "", quiet_end: "" })).toMatchObject({ quietHours: false });
  });
});

describe("quiet hours storage", () => {
  it("defaults to 8pm–6am when never saved or unreadable", () => {
    expect(quietHoursFromRow({ quiet_start: null, quiet_end: null })).toEqual({ start: 20, end: 6 });
    expect(quietHoursFromRow({ quiet_start: "9pm", quiet_end: "06:00" })).toEqual({ start: 20, end: 6 });
    expect(quietHoursFromRow({ quiet_start: "25:00", quiet_end: "06:00" })).toEqual({ start: 20, end: 6 });
    expect(quietHoursFromRow({ quiet_start: "06:00", quiet_end: "06:00" })).toEqual({ start: 20, end: 6 });
  });

  it("round-trips through the row format", () => {
    expect(quietHoursToRow({ quietHours: true, quietStart: 21, quietEnd: 7 })).toEqual({ quiet_start: "21:00", quiet_end: "07:00" });
    expect(quietHoursFromRow({ quiet_start: "21:00", quiet_end: "07:00" })).toEqual({ start: 21, end: 7 });
    expect(quietHoursToRow({ quietHours: false, quietStart: 20, quietEnd: 6 })).toEqual({ quiet_start: "", quiet_end: "" });
    expect(quietHoursFromRow({ quiet_start: "", quiet_end: "" })).toBeNull();
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

  it("treats a missing messages switch as on (pages loaded before it existed) and rejects a non-boolean", () => {
    const { messages: _m, ...old } = valid;
    expect(validateEmailAlertSettings(old)).toEqual({ ...old, messages: true });
    expect(validateEmailAlertSettings({ ...valid, messages: false })).toEqual({ ...valid, messages: false });
    expect(validateEmailAlertSettings({ ...valid, messages: "yes" })).toHaveProperty("error");
  });

  it("defaults quiet hours when a request doesn't send them", () => {
    const { quietHours: _q, quietStart: _s, quietEnd: _e, ...old } = valid;
    expect(validateEmailAlertSettings(old)).toEqual({ ...old, ...DEFAULT_QUIET });
  });

  it("accepts quiet hours off without hours", () => {
    expect(validateEmailAlertSettings({ ...valid, quietHours: false, quietStart: undefined, quietEnd: undefined })).toMatchObject({ quietHours: false });
  });

  it("rejects bad quiet hours", () => {
    for (const bad of [{ quietStart: 24 }, { quietEnd: -1 }, { quietStart: 7.5 }, { quietEnd: "6" }, { quietStart: 7, quietEnd: 7 }, { quietHours: "yes" }]) {
      expect(validateEmailAlertSettings({ ...valid, ...bad })).toHaveProperty("error");
    }
  });

  it("rejects a missing body", () => {
    expect(validateEmailAlertSettings(null)).toHaveProperty("error");
  });
});
