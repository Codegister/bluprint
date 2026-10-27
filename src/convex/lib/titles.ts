/**
 * Set titles.
 *
 * A set used to be named after the first line of whatever was pasted, which
 * produced titles like "The process by which plants convert light energy into".
 * Titles are now short topic names: two to five words, assembled from whole
 * words only, and written the way a student would write them on a folder
 * ("Osmosis and Active Transport"), not like a truncated sentence.
 *
 * This module is deliberately dependency-free so the browser and the Convex
 * runtime can import exactly the same rules.
 */

/** Words that never make a good title, so a source line starting with one is skipped. */
const FILLER_START =
  /^(the|a|an|this|these|those|it|there|in|on|at|for|and|but|so|when|if|as|by|to|of|from|chapter|section|page|unit|notes?)\b/i;

/** Join words that stay lowercase inside a title. */
const SMALL_WORDS = new Set([
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
  "via",
  "vs",
  "with",
]);

/**
 * A finite verb means the phrase is a sentence, not a topic. "Osmosis Is the
 * Diffusion of Water" is a sentence about osmosis; the title is "Osmosis".
 */
const COPULA =
  /^(is|are|was|were|be|been|being|am|means|refers|occurs|happens|describes|involves|includes|allows|causes|makes|has|have|had|can|could|will|would|should)$/i;

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

/**
 * Writes a phrase without mechanically capitalising every word. The first
 * letter is capitalised, join words stay lowercase, and anything the source
 * already capitalised (proper nouns, abbreviations) is left alone.
 */
function sentenceCase(phrase: string): string {
  const words = phrase.split(" ");
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      // Keep acronyms and mixed-case words exactly as written.
      if (word !== lower) return word;
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    })
    .join(" ");
}

/**
 * A short title from free text: at most `maxWords` whole words and `maxChars`
 * characters, never cut inside a word, with no trailing join word and no
 * Title Case applied per word.
 */
export function shortTitle(
  value: string,
  maxWords = 5,
  maxChars = 48,
): string {
  const cleaned = cleanCandidate(value);
  if (cleaned.length === 0) return "";

  const words = cleaned.split(" ");
  // A title cannot dangle on "of", "the" or "and": drop those from the end
  // before the word cap is applied, so "Osmosis Is the Diffusion of" becomes
  // "Osmosis Is the Diffusion" rather than a phrase that stops mid-thought.
  while (words.length > 1 && SMALL_WORDS.has(words[words.length - 1]!.toLowerCase())) {
    words.pop();
  }

  const kept: string[] = [];
  for (const word of words) {
    if (kept.length >= maxWords) break;
    const next = [...kept, word].join(" ");
    if (next.length > maxChars) break;
    kept.push(word);
  }
  // A single word longer than the character cap is kept whole rather than cut.
  const phrase = (kept.length > 0 ? kept : [words[0]!]).join(" ");
  return sentenceCase(phrase.replace(/[,;:]+$/, ""));
}

/** Whether a phrase reads as a topic name rather than a truncated sentence. */
export function isTopicTitle(value: string): boolean {
  const cleaned = cleanCandidate(value);
  if (!cleaned) return false;
  const words = cleaned.split(" ");
  if (words.length < 2 || words.length > 5) return false;
  if (SMALL_WORDS.has(words[0]!.toLowerCase())) return false;
  if (SMALL_WORDS.has(words[words.length - 1]!.toLowerCase())) return false;
  if (words.some((word) => COPULA.test(word))) return false;
  if (/[.!?]$/.test(cleaned)) return false;
  return true;
}

/**
 * The title for a generated set: the model's own topic name when it reads like
 * one, otherwise a clean subject label. Never the first sentence of the notes.
 */
export function cleanTopicTitle(value: string, fallback: string): string {
  const title = shortTitle(value);
  if (isTopicTitle(title)) return title;

  const label = shortTitle(fallback);
  return label || "Study notes";
}

/**
 * The first line of a source that reads like a heading, or an empty string.
 * A heading is short, has no full stop, and does not start with filler; the
 * first sentence of a paragraph is not a title, so it is never returned.
 */
export function titleFromSource(source: string): string {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    const candidate = cleanCandidate(
      line.replace(/^#{1,6}\s*/, "").replace(/[*_`]+/g, ""),
    );
    if (candidate.length < 3) continue;
    if (/[.!?]$/.test(line)) continue;
    if (FILLER_START.test(candidate)) continue;
    const title = shortTitle(candidate);
    if (isTopicTitle(title)) return title;
  }
  return "";
}
