import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { TUTOR_TIERS } from "../src/convex/lib/nvidiaConfig";
import {
  TUTOR_CUT_SHORT_MESSAGE,
  TutorCutShort,
  acceptedTutorText,
  isLengthStop,
  readTutorStream,
  stripTutorMeta,
} from "../src/convex/lib/tutorReply";

/** A provider stream built from the same SSE frames the endpoint sends. */
function sse(...frames: string[]): Response {
  return new Response(frames.map((frame) => `data: ${frame}\n\n`).join(""));
}

describe("tutor reply shape", () => {
  test("the live meta line is stripped before the answer is stored", () => {
    const live =
      "NO MARKING IN THIS REPLY: the student is not answering a question you asked, so do not give a mark out of N, do not say 'Not credited:', and do not grade their message.\n\nAmylase breaks starch into maltose in the small intestine.";
    expect(stripTutorMeta(live)).toBe(
      "Amylase breaks starch into maltose in the small intestine.",
    );
  });

  test("a leading mark line and a Not credited list are stripped", () => {
    const text = "Mark: 0/2\nNot credited: named the enzyme\n\nPepsin works in the stomach.";
    expect(stripTutorMeta(text)).toBe("Pepsin works in the stomach.");
  });

  test("a real answer that discusses marking is not touched", () => {
    const answer =
      "Your answer earns one mark because you named amylase and linked it to starch.";
    expect(stripTutorMeta(answer)).toBe(answer);
  });

  test("a length stop is recognised and the message is retryable", () => {
    expect(isLengthStop("length")).toBe(true);
    expect(isLengthStop("stop")).toBe(false);
    expect(isLengthStop(undefined)).toBe(false);
    expect(TUTOR_CUT_SHORT_MESSAGE).toContain("cut short");
    expect(TUTOR_CUT_SHORT_MESSAGE.toLowerCase()).toContain("ask again");
  });

  test("Fast, Balanced and Deep have different model ceilings", () => {
    const ids = TUTOR_TIERS.map((tier) => tier.id);
    expect(ids).toEqual(["fast", "balanced", "deep"]);
    const models = new Set(TUTOR_TIERS.map((tier) => tier.model));
    expect(models.size).toBe(TUTOR_TIERS.length);
    // Thinking and the visible answer share the ceiling.
    const budgets = TUTOR_TIERS.map(
      (tier) => tier.maxTokens - (tier.thinking ? tier.thinkingTokens : 0),
    );
    expect(budgets[0]!).toBeLessThan(budgets[1]!);
    expect(budgets[1]!).toBeLessThan(budgets[2]!);
    for (const budget of budgets) expect(budget).toBeGreaterThan(200);
  });

  test("a mocked length-stopped stream is shown as it arrives, then discarded", async () => {
    const snapshots: string[] = [];
    const response = sse(
      JSON.stringify({ choices: [{ delta: { content: "Amylase breaks starch" } }] }),
      JSON.stringify({ choices: [{ delta: { content: " into maltose in the" } }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] }),
      "[DONE]",
    );

    const result = await readTutorStream(response, async (text) => {
      snapshots.push(text);
    });

    // The half answer reached the browser, so the retry must replace it.
    expect(snapshots[0]).toContain("Amylase breaks starch");
    expect(result.text).toBe("Amylase breaks starch into maltose in the");
    expect(result.finishReason).toBe("length");

    let stored: string | null = null;
    expect(() => {
      stored = acceptedTutorText(result);
    }).toThrow(TutorCutShort);
    expect(() => acceptedTutorText(result)).toThrow(TUTOR_CUT_SHORT_MESSAGE);
    expect(stored).toBeNull();
  });

  test("a completed mocked stream is kept and its meta line is stripped", async () => {
    const response = sse(
      JSON.stringify({
        choices: [
          {
            delta: {
              content:
                "NO MARKING IN THIS REPLY: do not grade this message.\n\nPepsin works in the stomach.",
            },
          },
        ],
      }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] }),
      "[DONE]",
    );

    const result = await readTutorStream(response, async () => {});
    expect(acceptedTutorText(result)).toBe("Pepsin works in the stomach.");
  });

  test("the prompt no longer contains the counter-instruction models repeated", () => {
    const source = readFileSync("src/convex/ai.ts", "utf8");
    expect(source).not.toContain("NO_MARKING_RULES");
    expect(source).not.toContain("NO MARKING IN THIS REPLY");
  });
});
