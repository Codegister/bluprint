import { describe, expect, test } from "bun:test";

import { prepareCards } from "../src/convex/lib/studySetQuality";
import { SYLLABUS_SCOPE_HEADER } from "../src/convex/lib/syllabusOutline";
import {
  SYLLABUS_CONTENT_SOURCE,
  cardSourceRule,
  contentNotSpecRule,
  examSourceRule,
  quizSourceRule,
  summaryFidelityRule,
} from "../src/convex/lib/syllabusPrompt";

/**
 * A course brief never states the facts its topics name. The generators used
 * to carry instructions like "if the material does not state the fact, do not
 * write the card" on every build, so a course set asked the model for an empty
 * deck. These tests pin the two prompt contracts so that cannot come back.
 */
describe("course-set generation prompts", () => {
  test("the syllabus path asks for subject facts, not silence", () => {
    const syllabusRules = [
      cardSourceRule(true),
      quizSourceRule(true),
      examSourceRule(true),
      summaryFidelityRule(true),
      contentNotSpecRule(true),
    ];
    for (const rule of syllabusRules) {
      expect(rule).not.toMatch(
        /material above|stated in the material|faithful to the material|supported by the material|If the material does not state the fact|material cannot support/i,
      );
    }
    expect(SYLLABUS_CONTENT_SOURCE).toMatch(/does not state the facts/i);
    expect(cardSourceRule(true)).toMatch(/write the fact/i);
    expect(quizSourceRule(true)).toMatch(/subject content/i);
    expect(examSourceRule(true)).toMatch(/subject knowledge/i);
    expect(summaryFidelityRule(true)).toMatch(/subject content/i);
  });

  test("uploads keep the grounding instructions", () => {
    expect(cardSourceRule(false)).toMatch(/does not state the fact/i);
    expect(quizSourceRule(false)).toMatch(/stated in the material above/i);
    expect(examSourceRule(false)).toMatch(
      /directly supported by the material above/i,
    );
    expect(summaryFidelityRule(false)).toMatch(/faithful to the material/i);
    expect(contentNotSpecRule(false)).toMatch(/material cannot support/i);
  });
});

describe("course-set deck filtering", () => {
  test("distinct facts on one topic are not collapsed as one source sentence", () => {
    const outline = [
      "Course: GCSE Chemistry",
      "Exam board: Pearson Edexcel",
      "",
      SYLLABUS_SCOPE_HEADER,
      "",
      "Topic: Atomic Structure",
      "Unit: Atomic Structure",
      "A proton has a relative charge of +1.",
      "A proton has a relative mass of 1.",
    ].join("\n");
    const cards = [
      {
        front: "What is the charge of a proton?",
        back: "A proton has a relative charge of +1.",
      },
      {
        front: "What is the mass of a proton?",
        back: "A proton has a relative mass of 1.",
      },
    ];
    // The two answers share the outline's only content unit, so the note-source
    // duplicate rule would drop the second card even though they test different
    // facts. An outline has no source sentences, so both must survive.
    expect(prepareCards(cards, outline).cards).toHaveLength(2);

    // "Beyond your notes" describes an upload that left its source, not a
    // course card that adds the content the scope names.
    const flagged = prepareCards(
      [{ ...cards[0]!, beyondNotes: true }],
      outline,
    );
    expect(flagged.cards[0]?.beyondNotes).toBeUndefined();
    const uploaded = prepareCards(
      [{ ...cards[0]!, beyondNotes: true }],
      "Charge of a proton: A proton has a relative charge of +1.",
    );
    expect(uploaded.cards[0]?.beyondNotes).toBe(true);
  });
});
