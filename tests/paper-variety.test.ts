import { describe, expect, test } from "bun:test";

import {
  questionsTooSimilar,
  seedFromString,
  seededShuffle,
} from "../src/convex/lib/paperGenerator/variety";

const natureOfGodReason =
  "Explain two beliefs about the nature of God in Catholic Christianity, giving a reason or example for each.";
const natureOfGodAuthority =
  "Explain two beliefs about the nature of God in Catholic Christianity, referring to a source of authority or a religious teaching.";

describe("practice-paper variety", () => {
  test("rejects the same RS focus with only a different task or tariff", () => {
    expect(
      questionsTooSimilar(natureOfGodReason, natureOfGodAuthority),
    ).toBe(true);
  });

  test("allows a genuinely different focus", () => {
    expect(
      questionsTooSimilar(
        natureOfGodReason,
        "Explain two beliefs about the Trinity in Catholic Christianity, giving a reason or example for each.",
      ),
    ).toBe(false);
  });

  test("gives each build a stable but different topic order", () => {
    const topics = [
      "Nature of God",
      "The Trinity",
      "Creation",
      "Incarnation",
      "Redemption",
      "Eschatology",
      "The Church",
      "Sacraments",
    ];
    const first = seededShuffle(topics, seedFromString("paper-a:100"));
    const firstAgain = seededShuffle(topics, seedFromString("paper-a:100"));
    const second = seededShuffle(topics, seedFromString("paper-b:200"));

    expect(first).toEqual(firstAgain);
    expect(second).not.toEqual(first);
    expect(new Set(first)).toEqual(new Set(topics));
  });
});
