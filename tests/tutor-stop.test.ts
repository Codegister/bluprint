import { describe, expect, test } from "bun:test";
import {
  builtSetsFields,
  isReplayableReply,
  replySetIds,
  stopReplyFields,
  stoppedReplyCaption,
  stoppedReplyIsEmpty,
  type TutorReplyRow,
} from "../src/convex/lib/tutorStop";

/** Applies a field patch the way the mutation writes it. */
function apply(row: TutorReplyRow, fields: Partial<TutorReplyRow>): TutorReplyRow {
  return { ...row, ...fields };
}

describe("server stop path", () => {
  test("a partial reply keeps its text and is marked stopped", () => {
    const row: TutorReplyRow = {
      content: "Photosynthesis has two stages, starting with",
      streaming: true,
    };
    const fields = stopReplyFields(row);

    expect(fields).toEqual({ streaming: false, stopped: true });
    const stopped = apply(row, fields!);
    expect(stopped.content).toBe("Photosynthesis has two stages, starting with");
    expect(stopped.streaming).toBe(false);
    expect(stopped.stopped).toBe(true);
    expect(stoppedReplyIsEmpty(stopped)).toBe(false);
    expect(stoppedReplyCaption(stopped)).toContain("You stopped this answer");
  });

  test("an empty reply is kept and shows as stopped, not as a blank bubble", () => {
    const row: TutorReplyRow = { content: "", streaming: true };
    const fields = stopReplyFields(row);

    expect(fields).toEqual({ streaming: false, stopped: true });
    const stopped = apply(row, fields!);
    expect(stopped.content).toBe("");
    expect(stopped.stopped).toBe(true);
    expect(stoppedReplyIsEmpty(stopped)).toBe(true);
    expect(stoppedReplyCaption(stopped)).toBeNull();
  });

  test("a finished reply is left alone", () => {
    expect(
      stopReplyFields({ content: "Done.", streaming: false, stopped: false }),
    ).toBeNull();
    expect(stopReplyFields({ content: "Done." })).toBeNull();
  });

  test("set links survive a stop", () => {
    const stopped: TutorReplyRow = {
      content: "",
      streaming: false,
      stopped: true,
    };

    const withLinks = apply(stopped, builtSetsFields(["set-bio", "set-spa"]));

    expect(replySetIds(withLinks)).toEqual(["set-bio", "set-spa"]);
    expect(withLinks.builtSetId).toBe("set-bio");
    expect(stoppedReplyIsEmpty(withLinks)).toBe(true);
  });

  test("a stopped reply is not replayed as tutor history", () => {
    expect(isReplayableReply({ streaming: false, stopped: true })).toBe(false);
    expect(isReplayableReply({ streaming: true })).toBe(false);
    expect(isReplayableReply({ streaming: false })).toBe(true);
    expect(isReplayableReply({})).toBe(true);
  });

  test("older replies keep their single set link", () => {
    expect(replySetIds({ content: "x", builtSetId: "set-old" })).toEqual(["set-old"]);
    expect(replySetIds({ content: "x" })).toEqual([]);
  });

  test("a stopped reply renders partial text before the caption", () => {
    const partial: TutorReplyRow = {
      content: "Half an answer",
      streaming: false,
      stopped: true,
    };
    expect(stoppedReplyIsEmpty(partial)).toBe(false);
    expect(stoppedReplyCaption(partial)).toContain(
      "Sets already built are linked below",
    );
  });

  test("a normal finished reply has no stopped UI", () => {
    const normal: TutorReplyRow = { content: "An answer", streaming: false };
    expect(stoppedReplyIsEmpty(normal)).toBe(false);
    expect(stoppedReplyCaption(normal)).toBeNull();
  });
});
