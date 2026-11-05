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

/** Words that cannot carry a topic name on their own. */
/** Verbs that make a frequency-selected bigram a clause, not a topic name. */
const TITLE_ACTION_WORDS = new Set([
  "increases",
  "decreases",
  "lowers",
  "raises",
  "speeds",
  "slows",
  "makes",
  "uses",
  "controls",
  "releases",
  "absorbs",
  "produces",
  "carries",
  "reaches",
  "balances",
  "occurs",
  "takes",
  "passes",
  "comes",
]);

const TITLE_STOP_WORDS = new Set([
  ...SMALL_WORDS,
  "about",
  "above",
  "after",
  "before",
  "being",
  "between",
  "both",
  "during",
  "each",
  "from",
  "into",
  "more",
  "most",
  "other",
  "over",
  "same",
  "some",
  "such",
  "than",
  "then",
  "there",
  "these",
  "they",
  "through",
  "under",
  "very",
  "which",
  "while",
  "with",
  "would",
]);

/**
 * The notes' own dominant noun phrase, used when the model omits a usable
 * title. A set is never called "Study notes": the most repeated adjacent
 * content words are always a more useful folder name than that.
 */
export function dominantNounPhrase(text: string): string {
  const tokens = (text.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? [])
    .map((word) => word.toLowerCase())
    .filter(
      (word) =>
        !TITLE_STOP_WORDS.has(word) &&
        !TITLE_ACTION_WORDS.has(word) &&
        !COPULA.test(word),
    );
  if (tokens.length === 0) return "Study topic";

  const bigrams = new Map<string, number>();
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    const key = `${tokens[index]} ${tokens[index + 1]}`;
    bigrams.set(key, (bigrams.get(key) ?? 0) + 1);
  }
  const bestBigram = [...bigrams.entries()].sort(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length,
  )[0];
  if (bestBigram && bestBigram[1] > 1) {
    const title = shortTitle(bestBigram[0]);
    if (isTopicTitle(title)) return title;
  }

  const counts = new Map<string, number>();
  for (const word of tokens) counts.set(word, (counts.get(word) ?? 0) + 1);
  const first = tokens
    .map((word) => ({ word, count: counts.get(word) ?? 0 }))
    .sort((a, b) => b.count - a.count || b.word.length - a.word.length)[0]!;
  const at = tokens.indexOf(first.word);
  const phrase = [first.word, tokens[at + 1]].filter(Boolean).join(" ");
  return shortTitle(phrase) || shortTitle(first.word) || "Study topic";
}

/**
 * The title for a generated set: the model's own topic name when it reads like
 * one, otherwise a dominant noun phrase from the notes, then a clean subject
 * label. Never the first sentence of the notes and never "Study notes".
 */
export function cleanTopicTitle(value: string, fallback: string): string {
  const title = shortTitle(value);
  if (isTopicTitle(title)) return title;

  const label = shortTitle(fallback) || dominantNounPhrase(fallback);
  if (isTopicTitle(label)) return label;
  return dominantNounPhrase(fallback);
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
