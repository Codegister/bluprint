import { describe, expect, test } from "bun:test";
import { offersStudySet, questionForReply } from "../src/lib/tutorMaterial";

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

  test("does not offer when the tutor already built from the conversation", () => {
    expect(
      offersStudySet(
        turns("can you generate a set using all the quotes you've given me?"),
        1,
      ),
    ).toBe(false);
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
