import { describe, expect, test } from "bun:test";

import {
  buildFailureCopy,
  partialStageNote,
} from "../src/convex/lib/buildFailure";

describe("build failure copy", () => {
  test("names the stage that failed and the work that survived", () => {
    const message = buildFailureCopy("exam", { cards: 10, quiz: 5, exams: 0 });
    expect(message).toContain("exam-question stage");
    expect(message).toContain("10 flashcards");
    expect(message).toContain("5 quiz questions");
    expect(message).toContain("can be opened now");
    expect(message).toContain("retry immediately");
    // Never leaks provider, model or HTTP detail.
    expect(message).not.toMatch(/NVIDIA|HTTP|model|account/i);
  });

  test("an all-empty failure does not promise content that is not there", () => {
    const message = buildFailureCopy("summary", { cards: 0, quiz: 0, exams: 0 });
    expect(message).toContain("summary stage");
    expect(message).toContain("No cards or questions were saved");
    expect(message).not.toContain("can be opened now");
  });

  test("a rate limit is named without exposing a provider", () => {
    const message = buildFailureCopy("cards", { cards: 0, quiz: 0, exams: 0 }, true);
    expect(message).toContain("rate-limited");
    expect(message).not.toMatch(/429|NVIDIA|HTTP/i);
  });

  test("a finished set explains the missing section in plain words", () => {
    expect(partialStageNote("quiz")).toBe(
      "The quiz stage failed, so that section is missing. Everything else in this set is complete.",
    );
  });
});
