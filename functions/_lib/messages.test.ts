import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH, validateMessageBody } from "./messages";

describe("validateMessageBody", () => {
  it("trims and accepts ordinary text", () => {
    expect(validateMessageBody("  On my way home  ")).toEqual({ body: "On my way home" });
  });

  it("rejects empty, blank, non-text and over-long messages", () => {
    expect(validateMessageBody("")).toHaveProperty("error");
    expect(validateMessageBody("   \n ")).toHaveProperty("error");
    expect(validateMessageBody(42)).toHaveProperty("error");
    expect(validateMessageBody(undefined)).toHaveProperty("error");
    expect(validateMessageBody("x".repeat(MAX_MESSAGE_LENGTH + 1))).toHaveProperty("error");
    expect(validateMessageBody("x".repeat(MAX_MESSAGE_LENGTH))).toEqual({ body: "x".repeat(MAX_MESSAGE_LENGTH) });
  });
});
