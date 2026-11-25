import { describe, expect, test } from "bun:test";
import {
  offersStudySet,
  questionForReply,
  tutorReplyCounts,
} from "../src/lib/tutorMaterial";

type Turn = { role: string; content: string; streaming?: boolean };

const NOTE =
  "Cell division:\n- Mitosis produces two genetically identical diploid cells.\n" +
  "- Meiosis produces four genetically different haploid gametes.\n" +
  "- Checkpoints control whether the cycle continues.";

function turns(question: string, reply = NOTE, extra: Partial<Turn> = {}): Turn[] {
  return [
    { role: "user", content: question },
    { role: "assistant", content: reply, ...extra },
  ];
}

describe("turn a tutor reply into a study set", () => {
  test("offers a set on a reply to a notes-to-set request", () => {
    // The report: \"I asked it to turn some notes into a set\" produced printed
    // notes and no way to keep them. The reply now carries the offer.
    expect(offersStudySet(turns("Turn some notes into a set"), 1)).toBe(true);
    expect(offersStudySet(turns("Summarise this page into revision notes"), 1)).toBe(true);
    expect(offersStudySet(turns("Give me the key points"), 1)).toBe(true);
  });

  test("does not offer on marking or a question about the feature", () => {
    expect(offersStudySet(turns("Mark my answer"), 1)).toBe(false);
    expect(offersStudySet(turns("What is a study set?"), 1)).toBe(false);
  });

  test("never offers once the reply already links a set it built", () => {
    expect(offersStudySet(turns("Turn these notes into a set"), 1, ["set1"])).toBe(false);
  });

  test("waits for the reply to finish and to be long enough to build from", () => {
    expect(
      offersStudySet(turns("Turn these notes into a set", NOTE, { streaming: true }), 1),
    ).toBe(false);
    expect(offersStudySet(turns("Turn these notes into a set", "Sure."), 1)).toBe(false);
  });

  test("offers a set when the tutor is asked to use its own earlier material", () => {
    expect(
      offersStudySet(
        turns("can you generate a set using all the quotes you've given me?"),
        1,
      ),
    ).toBe(true);
  });

  test("finds the question a reply answered across assistant turns", () => {
    const thread: Turn[] = [
      { role: "user", content: "Turn these notes into a set" },
      { role: "assistant", content: NOTE },
      { role: "assistant", content: "A follow-up line." },
    ];
    expect(questionForReply(thread, 2)).toBe("Turn these notes into a set");
    expect(questionForReply(thread, 0)).toBeNull();
  });
});

describe("counts for a reply's set", () => {
  test("matches the reply: one card and one quiz question per point", () => {
    // The fixed 10/5/3 defaults built three quiz questions from a reply that
    // only made three points, and dropped most of a longer one. Cards and quiz
    // questions now each follow what the tutor actually wrote.
    expect(tutorReplyCounts(NOTE)).toEqual({ cards: 3, quiz: 3, exam: 1 });
  });

  test("grows past the old 10/5 defaults when the reply has more content", () => {
    const longer = [
      "Mitochondria release energy from glucose during aerobic respiration.",
      "Ribosomes assemble amino acids into proteins for the growing cell.",
      "The nucleus stores genetic material and controls the activities of the cell.",
      "Chloroplasts absorb light energy so plants can make their own food.",
      "The cell membrane controls which substances enter and leave the cell.",
      "A vacuole stores cell sap and helps keep the plant cell firm.",
      "Cell walls are made of cellulose and give plant cells their shape.",
      "Diffusion moves particles from high to low concentration without energy.",
      "Osmosis is the movement of water through a partially permeable membrane.",
      "Active transport moves substances against a concentration gradient using energy.",
      "Enzymes are proteins that speed up reactions without being used up.",
      "DNA carries the genetic instructions needed for growth and repair.",
    ]
      .map((point) => `- ${point}`)
      .join("\n");
    const counts = tutorReplyCounts(longer);
    expect(counts.cards).toBeGreaterThan(10);
    expect(counts.quiz).toBe(counts.cards);
    expect(counts.exam).toBe(3);
  });
});
