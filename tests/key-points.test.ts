import { describe, expect, test } from "bun:test";

import {
  keyPointForCard,
  keyPointsForCards,
} from "../src/convex/lib/studySetQuality";

const FUNCTION_TAIL = /(?:^|\s)(?:of|to|in|the|a|an|and|for|with|by|on|at|from|down)$/i;
const THIRD_PERSON_OPENING =
  /^(?:happens|occurs|increases|decreases|makes|breaks|causes|produces|forms|gives|takes|uses|allows|moves|changes|means|shows|contains|involves|affects|releases|absorbs|reflects|transmits|needs|requires|prevents|controls|regulates|carries|travels|reaches|becomes|remains|depends)\b/i;

describe("summary key points", () => {
  test("the generated key point is used instead of a rebuilt label", () => {
    const card = {
      front: "What happens to the rate of photosynthesis as light intensity increases?",
      back: "The rate rises, then plateaus once another factor becomes limiting.",
      keyPoint:
        "The rate of photosynthesis rises with light intensity until another factor limits it.",
    };
    expect(keyPointForCard(card)).toBe(card.keyPoint);
  });

  test("a fragmentary label falls back to the answer alone", () => {
    const card = {
      front: "What happens to the rate of photosynthesis as light intensity increases?",
      back: "The rate rises, then plateaus once another factor becomes limiting.",
    };
    const point = keyPointForCard(card);
    expect(point).toBe(card.back);
    expect(point).not.toContain(":");
    expect(point).not.toMatch(FUNCTION_TAIL);
    expect(point).not.toMatch(THIRD_PERSON_OPENING);
  });

  test("a generated key point that is itself a fragment is rejected", () => {
    const card = {
      front: "What happens to the rate of photosynthesis as light intensity increases?",
      back: "The rate rises, then plateaus.",
      keyPoint: "Happens to the rate of",
    };
    const point = keyPointForCard(card);
    expect(point).toBe(card.back);
  });

  test("no key point in a rebuilt deck ends in a function word", () => {
    const cards = [
      {
        front: "What is the rate of photosynthesis limited by?",
        back: "Light intensity, carbon dioxide concentration and temperature.",
      },
      {
        front: "Why does the rate of photosynthesis plateau?",
        back: "Another factor becomes limiting, so the rate cannot rise further.",
      },
      {
        front: "State the word equation for photosynthesis.",
        back: "Carbon dioxide + water → glucose + oxygen.",
      },
    ];
    for (const point of keyPointsForCards(cards)) {
      expect(point.length).toBeGreaterThan(0);
      expect(point).not.toMatch(FUNCTION_TAIL);
      expect(point).not.toMatch(THIRD_PERSON_OPENING);
    }
  });

  test("the rebuilt overview uses the generated claim for every card", () => {
    const points = keyPointsForCards([
      {
        front: "How does light intensity affect photosynthesis?",
        back: "The rate rises until another factor becomes limiting.",
        keyPoint:
          "The rate of photosynthesis rises with light intensity until another factor limits it.",
      },
      {
        front: "What limits the rate of photosynthesis?",
        back: "Light intensity and carbon dioxide concentration.",
        keyPoint:
          "Light intensity and carbon dioxide concentration limit the rate of photosynthesis.",
      },
    ]);
    expect(points).toEqual([
      "The rate of photosynthesis rises with light intensity until another factor limits it.",
      "Light intensity and carbon dioxide concentration limit the rate of photosynthesis.",
    ]);
  });
});
