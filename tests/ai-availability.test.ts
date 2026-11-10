import { describe, expect, test } from "bun:test";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  isAiUnavailable,
} from "../src/lib/aiAvailability";

describe("AI availability guard", () => {
  test("only an explicit not-configured status blocks an action", () => {
    expect(isAiUnavailable(undefined)).toBe(false);
    expect(isAiUnavailable(null)).toBe(false);
    expect(isAiUnavailable({ configured: true })).toBe(false);
    expect(isAiUnavailable({ configured: false })).toBe(true);
  });

  test("the blocked state says nothing was started", () => {
    expect(AI_NOT_CONFIGURED_MESSAGE).toContain("Nothing was started");
    expect(AI_NOT_CONFIGURED_MESSAGE).toContain("saved work");
  });
});
