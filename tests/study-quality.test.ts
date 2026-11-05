import { describe, expect, test } from "bun:test";

import { materialLimits } from "../src/convex/lib/buildCapacity";
import { BUILD_MAX, shortfallFor } from "../src/convex/lib/buildDefaults";
import { buildLimit } from "../src/convex/lib/buildLimits";
import { MIN_NOTE_CHARS } from "../src/convex/lib/noteLimits";
import {
  MAX_CARD_BACK_CHARS,
  cardNeedsRepair,
  cleanExplanation,
  explanationLeaksAnswer,
  formatOption,
  isClaimSupportedByNotes,
  isClozeQuestion,
  isInverseQuizPair,
  keyPointsForCards,
  mcqOptionIssue,
  prepareCards,
  prepareQuiz,
  quizScorePercent,
  repairCardAnswer,
  sourceCoverage,
  spreadCorrectPositions,
} from "../src/convex/lib/studySetQuality";
import { cleanTopicTitle, dominantNounPhrase } from "../src/convex/lib/titles";
import { createSetFailureMessage } from "../src/lib/errors";

/**
 * Glossary fixture: 8 short sentences. The ten candidate cards deliberately
 * include two paraphrases of the same fact and one invented adjective.
 */
const GLOSSARY_NOTES = `Homeostasis keeps internal conditions steady.
The set point is the target for control systems.
Negative feedback reverses a change and restores the set point.
Effectors include muscles and glands that carry out responses.
Sweating cools the body and shivering warms it.
The pancreas releases insulin and glucagon to control blood glucose.
Receptors detect stimuli and send information to coordination centres.
Coordination centres process information and send instructions to effectors.`;

const GLOSSARY_CARDS = [
  {
    front: "What is homeostasis?",
    back: "Homeostasis keeps internal conditions steady.",
  },
  {
    front: "What is the set point?",
    back: "The set point is the target for control systems.",
  },
  {
    front: "What does negative feedback do?",
    back: "Negative feedback reverses a change and restores the set point.",
  },
  {
    front: "How does negative feedback work?",
    back: "Negative feedback restores the set point after a change.",
  },
  {
    front: "What do effectors include?",
    back: "Effectors include muscles and glands that carry out responses.",
  },
  {
    front: "What do effectors produce?",
    back: "Effectors carry out responses.",
  },
  {
    front: "What is the target value for the set point?",
    back: "The set point is the target value for homeostasis.",
  },
  {
    front: "How is body temperature controlled?",
    back: "Sweating cools the body and shivering warms it.",
  },
  {
    front: "What controls blood glucose?",
    back: "The pancreas releases insulin and glucagon to control blood glucose.",
  },
  {
    front: "What do receptors detect?",
    back: "Receptors detect stimuli and send information to coordination centres.",
  },
];

/**
 * Haber fixture: twelve sentences. The last one is the fertiliser section.
 */
const HABER_SENTENCES = [
  "The Haber process makes ammonia from nitrogen and hydrogen.",
  "Nitrogen is obtained from the air.",
  "Hydrogen comes from natural gas.",
  "The gases pass over an iron catalyst.",
  "The iron catalyst speeds up the reaction.",
  "The reaction is reversible and reaches equilibrium.",
  "A pressure of 200 atmospheres is used.",
  "A temperature of about 450°C is used.",
  "Higher pressure increases the yield of ammonia.",
  "Lower temperature increases yield but slows the reaction.",
  "The compromise balances yield against rate.",
  "Ammonia is used to make fertilisers.",
];
const HABER_NOTES = HABER_SENTENCES.join(" ");

const DATED_NOTES = `The Battle of Hastings took place in 1066.
The Magna Carta was sealed in 1215.
The Black Death reached England in 1348.
The Spanish Armada sailed in 1588.
The English Civil War began in 1642.
The Glorious Revolution occurred in 1688.`;

describe("Part 1 — grounded, distinct cards", () => {
  test("1.1 a card back must state what the notes state, not an invented value", () => {
    expect(
      isClaimSupportedByNotes(
        GLOSSARY_NOTES,
        "Negative feedback restores the set point after a change.",
      ),
    ).toBe(true);
    expect(
      isClaimSupportedByNotes(
        GLOSSARY_NOTES,
        "The set point is the target value for homeostasis.",
      ),
    ).toBe(false);
  });

  test("1.2 paraphrases of one source sentence are one card", () => {
    const { cards, dropped } = prepareCards(GLOSSARY_CARDS, GLOSSARY_NOTES);
    expect(dropped).toBe(3);
    expect(cards).toHaveLength(7);
    expect(cards.some((card) => /target value/i.test(card.back))).toBe(false);
    expect(
      cards.filter((card) => /negative feedback/i.test(card.front)),
    ).toHaveLength(1);
    expect(cards.filter((card) => /effectors/i.test(card.front))).toHaveLength(
      1,
    );
  });

  test("1.3 one revision-ready key point per card, in order", () => {
    const { cards } = prepareCards(GLOSSARY_CARDS, GLOSSARY_NOTES);
    const points = keyPointsForCards(cards);
    expect(points).toHaveLength(cards.length);
    for (const point of points) {
      expect(point.length).toBeGreaterThan(10);
      expect(point).not.toBe("");
      expect(GLOSSARY_NOTES).not.toContain(point);
    }
  });

  test("1.4 source coverage is named when the fertiliser section is absent", () => {
    const partial = sourceCoverage(
      HABER_NOTES,
      HABER_SENTENCES.slice(0, 11),
    );
    expect(partial.omitted.join(" ")).toMatch(/fertilis/i);
    expect(partial.note).toMatch(/fertilis/i);

    const full = sourceCoverage(HABER_NOTES, HABER_SENTENCES);
    expect(full.omitted).toHaveLength(0);
    expect(full.note).toBeUndefined();
  });

  test("1.5 a topic title is derived from the notes, never 'Study notes'", () => {
    expect(dominantNounPhrase(HABER_NOTES)).not.toBe("Study notes");
    const title = cleanTopicTitle("", HABER_NOTES);
    expect(title).not.toBe("Study notes");
    expect(title).toMatch(/haber|ammonia|catalyst|equilibrium/i);
  });

  test("1.6 a shortfall states both numbers once", () => {
    const note = shortfallFor("cards", 7, 25);
    expect(note).toBe("Built 7 of 25. Your notes supported 7.");
    expect(note.match(/7/g)).toHaveLength(2);
    expect(note.match(/25/g)).toHaveLength(1);
  });
});

describe("Part 2 — quiz integrity", () => {
  const cards = [
    {
      front: "Where does photosynthesis happen?",
      back: "In chloroplasts.",
    },
    {
      front: "What absorbs light energy?",
      back: "Chlorophyll.",
    },
    {
      front: "How does carbon dioxide enter a leaf?",
      back: "Through stomata.",
    },
  ];

  const notes = `Photosynthesis takes place in chloroplasts.
Chlorophyll absorbs light energy.
Carbon dioxide enters through stomata.
Oxygen leaves through the stomata.
Glucose is used in respiration.
The pancreas releases insulin and glucagon to control blood glucose.
Sweating cools the body and shivering warms it.
Coordination centres process information and send instructions to effectors.`;

  test("2.1 a quiz question may not repeat a card fact", () => {
    const duplicate = {
      question: "Where does photosynthesis happen?",
      options: [
        "In chloroplasts",
        "In mitochondria",
        "In the xylem",
        "In the soil",
      ],
      correctIndex: 0,
      explanation:
        "Chloroplasts contain chlorophyll, while mitochondria release energy from glucose.",
      type: "mcq" as const,
    };
    const result = prepareQuiz([duplicate], cards, notes);
    expect(result.items).toHaveLength(0);
    expect(result.reasons).toContain("already on a card");
  });

  test("2.2 the same fact is never asked in both directions", () => {
    const receptor = {
      question: "Which component detects a stimulus in a homeostatic response?",
      options: ["Receptor", "Effector", "Gland", "Set point"],
      correctIndex: 0,
      explanation: "A receptor detects the stimulus.",
      type: "mcq" as const,
    };
    const stimulus = {
      question: "What does a receptor detect?",
      options: ["A stimulus", "A response", "An effector", "A set point"],
      correctIndex: 0,
      explanation: "A receptor detects a change in the environment.",
      type: "mcq" as const,
    };
    expect(isInverseQuizPair(receptor, stimulus)).toBe(true);
  });

  test("2.3 an explanation may not give away another question's answer", () => {
    const pressure = {
      question: "What pressure is used in the Haber process?",
      options: ["200 atmospheres", "100 atmospheres", "300 atmospheres", "400 atmospheres"],
      correctIndex: 0,
      explanation: "The reactor is held at 200 atmospheres.",
      type: "mcq" as const,
    };
    const compromise = {
      question: "Which pressure is the compromise condition?",
      options: [
        "200 atmospheres",
        "100 atmospheres",
        "300 atmospheres",
        "400 atmospheres",
      ],
      correctIndex: 0,
      explanation: "A high pressure raises yield, but stronger vessels cost more.",
      type: "mcq" as const,
    };
    expect(explanationLeaksAnswer(pressure, compromise)).toBe(true);
    expect(explanationLeaksAnswer(compromise, pressure)).toBe(false);
  });

  test("2.4 distractors are parallel and giveaway options are rejected", () => {
    const balanced = {
      question: "Which gas is released when a leaf photosynthesises?",
      options: ["Oxygen gas", "Nitrogen gas", "Methane gas", "Argon gas"],
      correctIndex: 0,
      explanation: "Oxygen is produced by the light-dependent reactions.",
      type: "mcq" as const,
    };
    expect(mcqOptionIssue(balanced)).toBeNull();

    const unbalanced = {
      question: "What compromise pressure is used in the Haber process and why?",
      options: [
        "200 atmospheres to increase yield while balancing equipment cost",
        "100 atmospheres",
        "300 atmospheres",
        "400 atmospheres",
      ],
      correctIndex: 0,
      explanation: "The compromise balances yield against equipment cost.",
      type: "mcq" as const,
    };
    expect(mcqOptionIssue(unbalanced)).toMatch(/longest|two-part/);

    const article = {
      question: "Which is an organelle?",
      options: [
        "Endoplasmic reticulum",
        "Mitochondrial matrix",
        "Chloroplast membrane",
        "Ribosomal subunit",
      ],
      correctIndex: 0,
      explanation: "The endoplasmic reticulum is a membrane-bound organelle.",
      type: "mcq" as const,
    };
    expect(mcqOptionIssue(article)).toBe("correct option is the only grammatical fit");
  });

  test("2.5 cloze deletion is rejected", () => {
    expect(
      isClozeQuestion({
        question: "_____ detects a stimulus.",
        type: "cloze",
      }),
    ).toBe(true);
    expect(
      isClozeQuestion({
        question: "Which structure detects a stimulus?",
        type: "mcq",
      }),
    ).toBe(false);
  });

  test("2.6 correct positions stay under 40% on a long quiz", () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      question: `Unique question ${index}`,
      options: ["Correct", "Wrong one", "Wrong two", "Wrong three"],
      correctIndex: 0,
      explanation: `Explanation ${index}`,
      type: "mcq" as const,
    }));
    const spread = spreadCorrectPositions(items);
    const counts = [0, 0, 0, 0];
    for (const item of spread) {
      counts[item.correctIndex] += 1;
      expect(item.options[item.correctIndex]).toBe("Correct");
    }
    expect(Math.max(...counts)).toBeLessThanOrEqual(8);
  });

  test("2.7 explanations never narrate the source", () => {
    const cleaned = cleanExplanation(
      "The material states that receptors detect stimuli.",
    );
    expect(cleaned).not.toMatch(/material|states/i);
    expect(cleaned).toMatch(/receptors detect stimuli/i);
    expect(formatOption("  oxygen gas. ")).toBe("Oxygen gas");
  });

  test("2.8 a perfect score is exactly 100", () => {
    expect(quizScorePercent(5, 5)).toBe(100);
    expect(quizScorePercent(4, 5)).toBe(80);
    expect(quizScorePercent(0, 0)).toBe(0);
  });
});

describe("Part 3 — build limits", () => {
  test("3.1 a short-note failure names the length and the action", () => {
    const message = createSetFailureMessage(
      new Error("Paste at least 40 characters of notes."),
      { noteLength: 33, requestedCards: 10 },
    );
    expect(message).toContain("33");
    expect(message).toContain(String(MIN_NOTE_CHARS));
    expect(message).toMatch(/add|retry/i);
  });

  test("3.2 the guest cap and the minimum material length are known before upload", () => {
    const guest = buildLimit("set", "guest");
    expect(guest.perHour).toBe(2);
    expect(guest.perDay).toBe(6);
    expect(MIN_NOTE_CHARS).toBe(40);
  });

  test("3.3 note-derived ranges never advertise more than the account maximum", () => {
    const limits = materialLimits(DATED_NOTES);
    for (const value of [limits.cards, limits.quiz, limits.exam]) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(BUILD_MAX);
    }
  });

  test("3.4 a quiz shortfall is reported against the stored count", () => {
    expect(shortfallFor("quiz", 3, 5)).toBe(
      "Bluprint can build 3 quiz questions from this note; add more detail for a full quiz.",
    );
  });
});

describe("Part 4 — stored-card repair", () => {
  test("4.1 long and mid-word answers are shortened without a dangling tail", () => {
    const long = `${"Enzyme concentration affects the rate of reaction because more active sites are available. ".repeat(
      20,
    )}so increasing substrate does not he`;
    const repaired = repairCardAnswer(long, MAX_CARD_BACK_CHARS);
    expect(repaired.length).toBeLessThanOrEqual(MAX_CARD_BACK_CHARS);
    expect(repaired).toMatch(/[.!?]$/);
    expect(cardNeedsRepair({ front: "Why does rate increase?", back: repaired })).toBe(
      false,
    );
    expect(
      cardNeedsRepair({
        front: "Why does rate increase?",
        back: "so increasing substrate does not he",
      }),
    ).toBe(true);

    const { cards } = prepareCards(
      [
        {
          front: "How does enzyme concentration affect rate?",
          back: long,
        },
      ],
      long,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]!.back.length).toBeLessThanOrEqual(MAX_CARD_BACK_CHARS);
    expect(cardNeedsRepair(cards[0]!)).toBe(false);
  });
});

describe("Part 5 — fixture sign-off", () => {
  test("5.1 Glossary: no duplicate or invented key points, disjoint quiz, no cloze or narration", () => {
    const { cards } = prepareCards(GLOSSARY_CARDS, GLOSSARY_NOTES);
    const points = keyPointsForCards(cards);
    expect(new Set(points).size).toBe(points.length);
    expect(points).toHaveLength(cards.length);
    expect(cards.some((card) => /target value/i.test(card.back))).toBe(false);

    const quiz = prepareQuiz(
      [
        {
          question: "What do receptors detect?",
          options: ["Stimuli", "Hormones", "Enzymes", "Gases"],
          correctIndex: 0,
          explanation:
            "Receptors detect stimuli and pass the signal on, while hormones travel in the blood.",
          type: "mcq",
        },
        {
          question: "_____ cools the body.",
          options: ["Sweating", "Shivering", "Insulin", "Glucagon"],
          correctIndex: 0,
          explanation: "Sweating cools the body by evaporation.",
          type: "cloze",
        },
        {
          question:
            "What do coordination centres do with information from receptors?",
          options: [
            "Process information",
            "Store information",
            "Ignore information",
            "Delete information",
          ],
          correctIndex: 0,
          explanation:
            "Coordination centres process information and pass it on, whereas receptors detect stimuli.",
          type: "mcq",
        },
        {
          question: "What do coordination centres send to effectors?",
          options: [
            "Send instructions",
            "Store instructions",
            "Ignore instructions",
            "Delete instructions",
          ],
          correctIndex: 0,
          explanation:
            "Coordination centres send instructions to effectors, whereas effectors carry out responses.",
          type: "mcq",
        },
      ],
      cards,
      GLOSSARY_NOTES,
      points,
    );

    expect(quiz.reasons).toContain("already on a card");
    expect(quiz.reasons).toContain("cloze deletion");
    for (const item of quiz.items) {
      expect(isClozeQuestion(item)).toBe(false);
      expect(item.explanation).not.toMatch(
        /the material|explicitly in the material|the notes state/i,
      );
      expect(item.question).not.toBe("What do receptors detect?");
    }
    expect(quiz.items.length).toBeGreaterThanOrEqual(2);
  });

  test("5.2 Haber: coverage, title, parallel options, no pressure leakage, truthful count", () => {
    const partial = sourceCoverage(HABER_NOTES, HABER_SENTENCES.slice(0, 11));
    expect(partial.note).toMatch(/fertilis/i);
    expect(cleanTopicTitle("", HABER_NOTES)).not.toBe("Study notes");
    expect(mcqOptionIssue({
      question: "What compromise pressure is used in the Haber process and why?",
      options: [
        "200 atmospheres to increase yield while balancing equipment cost",
        "100 atmospheres",
        "300 atmospheres",
        "400 atmospheres",
      ],
      correctIndex: 0,
      explanation: "The compromise balances yield against equipment cost.",
      type: "mcq",
    })).toMatch(/longest|two-part/);

    const pressureQuestions = prepareQuiz(
      [
        {
          question: "What does the iron catalyst do?",
          options: [],
          correctIndex: 0,
          explanation:
            "The iron catalyst speeds up the reaction, while a pressure of 200 atmospheres raises the yield.",
          type: "typed",
          answer: "Iron catalyst",
        },
        {
          question: "What compromise pressure is used in the Haber process and why?",
          options: [],
          correctIndex: 0,
          explanation:
            "A pressure of 200 atmospheres balances yield against equipment cost, whereas a lower pressure reduces yield.",
          type: "typed",
          answer: "200 atmospheres",
        },
      ],
      [],
      HABER_NOTES,
    );
    expect(pressureQuestions.items).toHaveLength(1);
    expect(pressureQuestions.items[0]!.question).toMatch(/pressure/i);
    expect(shortfallFor("cards", 7, 25)).toBe(
      "Built 7 of 25. Your notes supported 7.",
    );
  });

  test("5.3 Dated events: a small set builds, and a too-short note gets a specific action", () => {
    const cards = [
      {
        front: "When was the Battle of Hastings?",
        back: "1066.",
      },
      {
        front: "When was the Magna Carta sealed?",
        back: "1215.",
      },
      {
        front: "When did the Black Death reach England?",
        back: "1348.",
      },
    ];
    expect(prepareCards(cards, DATED_NOTES).cards).toHaveLength(3);

    const quiz = prepareQuiz(
      [
        {
          question: "Which year did the Spanish Armada sail?",
          options: [],
          correctIndex: 0,
          explanation: "The Armada sailed in 1588.",
          type: "typed",
          answer: "1588",
        },
        {
          question: "When did the English Civil War begin?",
          options: [],
          correctIndex: 0,
          explanation: "The Civil War began in 1642.",
          type: "typed",
          answer: "1642",
        },
      ],
      cards,
      DATED_NOTES,
    );
    expect(quiz.items).toHaveLength(2);

    const error = createSetFailureMessage(
      new Error("Paste at least 40 characters of notes."),
      { noteLength: 33, requestedCards: 3 },
    );
    expect(error).toContain("33");
    expect(error).toContain("40");
  });
});
