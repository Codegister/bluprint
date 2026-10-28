import { describe, expect, test } from "bun:test";

import { tutorScopeCaption } from "../src/lib/tutorScope";

/**
 * The caption under the tutor composer. It used to read "web search is off"
 * while the Web chip sat switched on beside it; these cases pin the caption to
 * what actually happened, so the contradiction cannot come back.
 */
describe("tutor web caption", () => {
  test("notes-only says where the answer comes from", () => {
    expect(
      tutorScopeCaption({
        useWeb: false,
        materialLabel: "this set's notes",
        latestSourceCount: null,
      }),
    ).toBe("Answering from this set's notes.");
  });

  test("web switched on with no answer yet promises a search, not sources", () => {
    const caption = tutorScopeCaption({
      useWeb: true,
      materialLabel: "this set's notes",
      latestSourceCount: null,
    });
    expect(caption).toContain("will search");
    expect(caption).not.toContain("web sources");
  });

  test("a searched answer counts the sources it cited", () => {
    expect(
      tutorScopeCaption({
        useWeb: true,
        materialLabel: "this set's notes",
        latestSourceCount: 3,
      }),
    ).toBe("Answering from this set's notes and 3 web sources.");
    expect(
      tutorScopeCaption({
        useWeb: true,
        materialLabel: "this set's notes",
        latestSourceCount: 1,
      }),
    ).toBe("Answering from this set's notes and 1 web source.");
  });

  test("a search that found nothing says so instead of implying sources", () => {
    expect(
      tutorScopeCaption({
        useWeb: true,
        materialLabel: "this course's notes",
        latestSourceCount: 0,
      }),
    ).toBe(
      "No useful web source was found, so this answer comes from this course's notes only.",
    );
  });

  test("the caption never says web search is off while the chip is on", () => {
    for (const count of [null, 0, 2]) {
      const caption = tutorScopeCaption({
        useWeb: true,
        materialLabel: "this set's notes",
        latestSourceCount: count,
      });
      expect(caption.toLowerCase()).not.toContain("off");
    }
  });
});
