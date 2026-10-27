/**
 * Set titles.
 *
 * A set used to be named after the first line of whatever was pasted, which
 * produced titles like "The process by which plants convert light energy into".
 * Titles are now short topic names, assembled from whole words only.
 *
 * This module is deliberately dependency-free so the browser and the Convex
 * runtime can import exactly the same rules.
 */

/** Words that never make a good title, so a source line starting with one is skipped. */
const FILLER_START =
  /^(the|a|an|this|these|those|it|there|in|on|at|for|and|but|so|when|if|as|by|to|of|from|chapter|section|page|unit|notes?)\b/i;

/** Tidies a candidate: no file extension, no punctuation at the edges. */
function cleanCandidate(value: string): string {
  return value
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/[^\p{L}\p{N}\s'&/:-]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s'"“”‘’.,;:!?–—-]+|[\s'"“”‘’.,;:!?–—-]+$/g, "")
    .trim();
}

/** Title Case for a short phrase; leaves words that are already mixed case. */
function titleCase(phrase: string): string {
  const small = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ]);
  return phrase
    .split(" ")
    .map((word, index) => {
      if (word !== word.toLowerCase()) return word;
      if (index > 0 && small.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * A short title from free text: at most `maxWords` whole words and `maxChars`
 * characters, never cut inside a word, with no trailing punctuation.
 */
export function shortTitle(
  value: string,
  maxWords = 5,
  maxChars = 48,
): string {
  const cleaned = cleanCandidate(value);
  if (cleaned.length === 0) return "";

  const words = cleaned.split(" ");
  const kept: string[] = [];
  for (const word of words) {
    if (kept.length >= maxWords) break;
    const next = [...kept, word].join(" ");
    if (next.length > maxChars) break;
    kept.push(word);
  }
  // A single word longer than the character cap is kept whole rather than cut.
  const phrase = (kept.length > 0 ? kept : [words[0]!]).join(" ");
  return titleCase(phrase.replace(/[,;:]+$/, ""));
}

/**
 * The first line of a source that reads like a heading, or a title made from
 * the first line that does. Used when a set arrives without a name of its own.
 */
export function titleFromSource(source: string): string {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    const candidate = cleanCandidate(line.replace(/^#{1,6}\s*/, "").replace(/[*_`]+/g, ""));
    if (candidate.length < 3) continue;
    const words = candidate.split(" ");
    // A heading is short and does not end in a full sentence.
    const looksLikeHeading = words.length <= 6 && !/[.!?]$/.test(line);
    const title = shortTitle(candidate);
    if (!title) continue;
    if (looksLikeHeading && !FILLER_START.test(title)) return title;
  }
  return shortTitle(lines[0] ?? "");
}
