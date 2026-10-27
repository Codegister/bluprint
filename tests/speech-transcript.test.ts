import { describe, expect, test } from "bun:test";

import {
  applyTranscript,
  commitTranscript,
  emptyTranscript,
  type TranscriptEvent,
  type TranscriptState,
} from "../src/lib/speechTranscript";

type Slot = { text: string; final?: boolean };

function event(slots: Slot[], resultIndex = 0): TranscriptEvent {
  const results: TranscriptEvent["results"] = { length: slots.length };
  slots.forEach((slot, index) => {
    results[index] = { transcript: slot.text, isFinal: Boolean(slot.final) };
  });
  return { resultIndex, results };
}

/** Feeds a list of events and returns the text after the last one. */
function run(
  events: TranscriptEvent[],
  state: TranscriptState = emptyTranscript(),
): { text: string; state: TranscriptState } {
  let current = state;
  let text = "";
  for (const next of events) {
    const applied = applyTranscript(current, next);
    current = applied.state;
    text = applied.text;
  }
  return { text, state: current };
}

describe("speech transcript", () => {
  test("a result the engine re-delivers is written once", () => {
    // Chrome can repeat a finished phrase at the same slot, or number the next
    // copy as if the session restarted. Both used to append the words again.
    const repeated = event([{ text: "controls", final: true }]);
    const { text } = run([repeated, repeated, repeated]);
    expect(text).toBe("controls");
  });

  test("re-delivered results from an earlier index do not duplicate words", () => {
    const first = event([
      { text: "controls", final: true },
      { text: "cell", final: true },
    ]);
    // resultIndex resets to zero while the results array keeps growing.
    const second = event([
      { text: "controls", final: true },
      { text: "cell", final: true },
      { text: "functions", final: true },
    ]);
    const { text } = run([first, second]);
    expect(text).toBe("controls cell functions");
  });

  test("interim text is replaced by its final, not added to it", () => {
    const { text } = run([
      event([{ text: "controls" }]),
      event([{ text: "controls cell" }]),
      event([{ text: "controls cell functions", final: true }]),
    ]);
    expect(text).toBe("controls cell functions");
  });

  test("an interim older than a final is dropped", () => {
    const { text } = run([
      event([{ text: "controls", final: true }, { text: "cell" }]),
      event([
        { text: "controls", final: true },
        { text: "cell functions", final: true },
      ]),
    ]);
    expect(text).toBe("controls cell functions");
  });

  test("an interim that flaps between lengths leaves one copy", () => {
    // The bug report: saying "controls cell functions" produced
    // "controls controls controls cell controls functions cell" because every
    // update was appended to the last. Slots overwrite, so it stays clean.
    const { text } = run([
      event([{ text: "controls" }]),
      event([{ text: "controls controls" }]),
      event([{ text: "controls cell" }]),
      event([{ text: "controls cell functions", final: true }]),
    ]);
    expect(text).toBe("controls cell functions");
  });

  test("typing before dictation is kept, exactly once", () => {
    const { text } = run(
      [
        event([{ text: "osmosis is", final: true }]),
        event([{ text: "osmosis is", final: true }, { text: "water", final: true }]),
      ],
      emptyTranscript("Explain"),
    );
    expect(text).toBe("Explain osmosis is water");
  });

  test("a restarted session continues the sentence without repeating it", () => {
    const first = run([
      event([{ text: "the nucleus controls", final: true }]),
    ]);
    const committed = commitTranscript(first.state, first.text);
    const second = run(
      [event([{ text: "cell functions", final: true }], 0)],
      committed,
    );
    expect(second.text).toBe("the nucleus controls cell functions");
  });

  test("an empty event leaves the text alone", () => {
    const { text } = run([event([]), event([{ text: "unchanged", final: true }])]);
    expect(text).toBe("unchanged");
    expect(applyTranscript(emptyTranscript("base"), event([])).text).toBe("base");
  });
});
