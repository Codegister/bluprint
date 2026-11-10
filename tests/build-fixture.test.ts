import { describe, expect, test } from "bun:test";

import { materialLimits } from "../src/convex/lib/buildCapacity";
import { BUILD_DEFAULTS } from "../src/convex/lib/buildDefaults";
import { buildFailureCopy } from "../src/convex/lib/buildFailure";
import { buildErrorMessage, readableError } from "../src/lib/errors";

/**
 * The audit pasted 1,438 characters of GCSE Biology notes. This fixture is the
 * same kind of material at the same size (1,445 characters), so the capacity
 * arithmetic is exercised with the input that failed, not with a two-line stub.
 */
const NOTES =
  "Cell structure. Eukaryotic cells contain a nucleus, cytoplasm, a cell membrane, mitochondria and ribosomes. Prokaryotic cells are much smaller, have no nucleus, and carry their DNA as a single loop plus plasmids. Plant cells also have a cellulose cell wall, a permanent vacuole and chloroplasts. Animal cells do not have these structures. Sperm cells have a tail to swim to the egg and many mitochondria to release energy. Nerve cells are long and branched so they can carry electrical impulses quickly. Muscle cells contain protein fibres that shorten when the cell contracts. Root hair cells have a large surface area for absorbing water and mineral ions from the soil. Xylem cells are hollow and strengthen the plant. Phloem cells have sieve plates so dissolved food can move. Diffusion is the net movement of particles from high to low concentration. The rate increases with a steeper concentration gradient, a higher temperature and a larger surface area. Osmosis is the diffusion of water through a partially permeable membrane from a dilute solution to a concentrated one. Active transport moves substances against a concentration gradient and requires energy from respiration. Root hair cells use active transport to absorb mineral ions from soil even when the soil concentration is lower than inside the cell. Required practical: place potato cylinders in different sugar solutions and measure the change in mass to investigate osmosis.";

describe("the audit's Biology build", () => {
  test("the material supports the default 10 cards, 5 quiz and 3 exam questions", () => {
    expect(NOTES.length).toBeGreaterThanOrEqual(1400);
    const limits = materialLimits(NOTES);
    expect({
      cards: Math.min(BUILD_DEFAULTS.cards, limits.cards),
      quiz: Math.min(BUILD_DEFAULTS.quiz, limits.quiz),
      exam: Math.min(BUILD_DEFAULTS.exam, limits.exam),
    }).toEqual({ cards: 10, quiz: 5, exam: 3 });
  });

  test("an exam-stage failure keeps and names the cards and quiz already saved", () => {
    const message = buildFailureCopy("exam", { cards: 10, quiz: 5, exams: 0 });
    expect(message).toContain("The exam-question stage did not finish");
    expect(message).toContain("10 flashcards, 5 quiz questions");
    expect(message).toContain("can be opened now");
    expect(message).toContain("retry immediately");
    // It must not promise the section that failed.
    expect(message).not.toContain("0 exam");
  });

  test("a summary-stage failure never claims content was kept", () => {
    const message = buildFailureCopy("summary", { cards: 0, quiz: 0, exams: 0 });
    expect(message).toContain("The summary stage did not finish");
    expect(message).toContain("No cards or questions were saved");
    expect(message).not.toContain("can be opened now");
  });

  test("the stage message survives the client display filter", () => {
    const message = buildFailureCopy("exam", { cards: 10, quiz: 5, exams: 0 });
    // The generic fallback used to replace this sentence before it reached the
    // page, which is how a failed build lost its cause and its retry guidance.
    expect(readableError(new Error(message), "The build could not be restarted.")).toBe(
      message,
    );
    expect(buildErrorMessage(message).message).toBe(message);
  });

  test("a rate-limited stage still names the stage and the work kept", () => {
    const message = buildFailureCopy("exam", { cards: 10, quiz: 5, exams: 0 }, true);
    const shown = buildErrorMessage(message);
    expect(shown.message).toContain("exam-question stage");
    expect(shown.message).toContain("10 flashcards");
    expect(shown.message).toContain("retry immediately");
  });
});
