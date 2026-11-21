import { stripReasoning } from "./reasoning";

/**
 * The rules that keep a tutor reply from becoming what it was told not to be.
 *
 * Two live failures are handled here, away from the streaming transport so they
 * can be tested without a provider:
 *
 *  - The old prompt contained a counter-instruction that named the format it
 *    forbade ("NO MARKING IN THIS REPLY … do not say 'Not credited:'"). Fast and
 *    Balanced models copied the sentence into the reply. The instruction is gone
 *    from the prompt, and any leading meta sentence that still arrives is
 *    stripped before the answer is stored or shown.
 *  - A stream that stops at the token ceiling was saved and shown as a complete
 *    answer. A length stop is now detected from the stream's `finish_reason` and
 *    reported, so the student can retry instead of revising a half sentence.
 */

/** Shown when the provider stopped the answer at the length ceiling. */
export const TUTOR_CUT_SHORT_MESSAGE =
  "That answer was cut short at the length limit, so it was not saved. Ask again — Balanced or Deep has more room for a long answer.";

/**
 * Raised when the provider stopped the stream at the token ceiling. The partial
 * answer is discarded rather than stored: a student must not be shown half a
 * reply as if it were complete. The action turns this into a retryable message.
 */
export class TutorCutShort extends Error {
  constructor() {
    super(TUTOR_CUT_SHORT_MESSAGE);
    this.name = "TutorCutShort";
  }
}

/** A page an answer cited, stored beside the message. */
export type StreamSource = { title: string; url: string };

/** What one streamed answer produced. */
export type StreamResult = {
  text: string;
  sources: StreamSource[];
  /** The model's own thinking, when the level produced any. */
  reasoning: string;
  /** The provider's stop reason for the final chunk ("stop", "length", …). */
  finishReason: string;
};

export type Snapshot = (
  fullText: string,
  sources: StreamSource[],
  reasoning: string,
) => Promise<void>;

/**
 * The beginning of an answer that talks about marking instead of answering.
 * Each pattern consumes its whole line: the meta sentence is the model's
 * preamble, never part of the subject answer.
 */
const META_LEADING_LINE = [
  /^NO MARKING IN THIS REPLY[^\n]*(?:\n+|$)/i,
  /^NO MARKING[^\n]*(?:\n+|$)/i,
  /^Not credited\s*:[^\n]*(?:\n+|$)/i,
  /^Credited\s*:[^\n]*(?:\n+|$)/i,
  /^Mark(?:ing)?\s*:\s*\d+\s*\/\s*\d+[^\n]*(?:\n+|$)/i,
  /^Score\s*:\s*\d+\s*\/\s*\d+[^\n]*(?:\n+|$)/i,
];

/**
 * A leading meta line about marking is removed; the subject answer after it is
 * kept. The loop is bounded and stops as soon as nothing changes, so a genuine
 * answer (including one that discusses marking as a topic) is untouched unless
 * it opens with the exact preamble shapes above.
 */
export function stripTutorMeta(text: string): string {
  let out = text.replace(/^\s+/, "");
  for (let pass = 0; pass < 4; pass += 1) {
    let next = out;
    for (const pattern of META_LEADING_LINE) {
      next = next.replace(pattern, "");
    }
    next = next.replace(/^\s+/, "");
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Whether the provider said the answer stopped because it ran out of tokens. */
export function isLengthStop(finishReason: string | null | undefined): boolean {
  return (finishReason ?? "").trim().toLowerCase() === "length";
}

/**
 * The streamed text a caller may store. A length stop throws instead of
 * returning the half sentence, so no caller can save a truncated answer by
 * checking the stop reason too late.
 */
export function acceptedTutorText(result: StreamResult): string {
  if (isLengthStop(result.finishReason)) throw new TutorCutShort();
  return result.text;
}

/**
 * The chat renders plain text, so markdown links and emphasis are flattened.
 * A link becomes its label; the full URL is still shown in the source list.
 */
function tidyTutorText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

/**
 * The answer as the student should see it.
 *
 * A model with thinking on can print its reasoning inline when the endpoint has
 * no reasoning parser. Closed blocks are removed, and an unclosed one hides
 * everything after it, so the first snapshots never flash chain-of-thought.
 */
function visibleAnswer(text: string): string {
  const closed = stripReasoning(text);
  const open = closed.search(/<think(?:ing)?>|<thought>|<reasoning>/i);
  return open >= 0 ? closed.slice(0, open) : closed;
}

/**
 * Reads an OpenAI-compatible server-sent-event chat stream, calling `onSnapshot`
 * roughly eight times a second with the text written so far. OpenRouter's web
 * plugin also streams url_citation annotations; those become the saved sources,
 * so the chat can show exactly which pages the answer used.
 */
export async function readTutorStream(
  response: Response,
  onSnapshot: Snapshot,
): Promise<StreamResult> {
  if (!response.body) throw new Error("The AI response had no body to read.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const sources: StreamSource[] = [];
  let buffer = "";
  let answer = "";
  // Reasoning models stream their thinking in a separate field. It is kept for
  // the reply's "Reasoning" disclosure, never mixed into the answer.
  let reasoning = "";
  // The provider's stop reason. A `length` stop means the answer was cut off
  // at the token ceiling; it used to be saved as if it were complete.
  let finishReason = "";
  let lastEmit = 0;

  const addSource = (candidate: unknown) => {
    const citation = (candidate as { url_citation?: { url?: unknown; title?: unknown } })
      ?.url_citation;
    const url = typeof citation?.url === "string" ? citation.url.trim() : "";
    if (!url) return;
    if (sources.some((source) => source.url === url)) return;
    const title = typeof citation?.title === "string" ? citation.title.trim() : "";
    sources.push({ title: title || url, url });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const payload = JSON.parse(data) as {
          choices?: Array<{
            finish_reason?: string | null;
            delta?: { content?: string; annotations?: unknown[] };
            message?: { annotations?: unknown[] };
          }>;
        };
        const choice = payload.choices?.[0];
        if (typeof choice?.finish_reason === "string" && choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
        const delta = choice?.delta as
          | { content?: string; reasoning_content?: string; reasoning?: string }
          | undefined;
        const piece = delta?.content;
        if (typeof piece === "string" && piece) answer += piece;
        const thought = delta?.reasoning_content ?? delta?.reasoning;
        if (typeof thought === "string" && thought) reasoning += thought;
        for (const annotation of [
          ...(choice?.delta?.annotations ?? []),
          ...(choice?.message?.annotations ?? []),
        ]) {
          addSource(annotation);
        }
      } catch {
        // A malformed keep-alive frame is not worth failing the answer over.
      }
    }

    const visible = visibleAnswer(answer);
    if ((visible || reasoning) && Date.now() - lastEmit > 120) {
      lastEmit = Date.now();
      await onSnapshot(
        stripTutorMeta(tidyTutorText(visible)),
        sources,
        reasoning.trim(),
      );
    }
  }

  return {
    text: stripTutorMeta(tidyTutorText(visibleAnswer(answer))).trim(),
    sources,
    reasoning: reasoning.trim(),
    finishReason,
  };
}
