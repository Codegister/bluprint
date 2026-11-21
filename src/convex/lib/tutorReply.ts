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
