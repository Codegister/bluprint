/**
 * How many cards, quiz questions and exam questions a note can honestly support.
 *
 * The previous calculation used words alone (one quiz per 30 words, one exam
 * per 90), so a 50-word note with five distinct facts was capped at one quiz
 * and one exam question. That looked like the notes had failed, not the
 * generator. Count distinct statements as well as words, with lower divisors,
 * so a five-fact note supports at least three quiz questions and two exam
 * questions.
 *
 * This module is dependency-free so the Convex action and the tests can share
 * exactly the same arithmetic.
 */

export type MaterialLimits = { cards: number; quiz: number; exam: number };

/**
 * How many words one statement is assumed to hold when a text has no sentence
 * punctuation to split on. Without this floor a slide deck written as fragments
 * counted as one statement: a 41-slide, 1,243-word deck was capped at two
 * cards, because nothing in it ended in a full stop.
 */
const WORDS_PER_STATEMENT_FLOOR = 40;

/** Statements in the material, used as a proxy for distinct facts. */
export function noteFacts(notes: string): string[] {
  const clean = notes.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // A statement ends at sentence punctuation or at a bullet. Slide decks and
  // handouts list each fact as its own bullet with no full stop, so bullets are
  // boundaries in their own right; the deck reader keeps them as `•`.
  const parts = clean
    .split(/(?<=[.!?;:])\s+|\s*[•·]\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20);
  const source = parts.length > 0 ? parts : [clean];

  const seen = new Set<string>();
  const facts: string[] = [];
  for (const part of source) {
    const key = part.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    facts.push(part);
  }
  return facts;
}

/**
 * The honest ceiling for one upload. The requested counts are applied later,
 * so this only says what the material itself can support.
 */
export function materialLimits(notes: string, max = 100): MaterialLimits {
  const clean = notes.replace(/\s+/g, " ").trim();
  const words = clean ? clean.split(" ").length : 0;
  const facts = Math.max(
    1,
    noteFacts(notes).length,
    // A long text that happens to carry no punctuation still holds facts.
    Math.ceil(words / WORDS_PER_STATEMENT_FLOOR),
  );
  const byWords = (divisor: number) => Math.max(1, Math.floor(words / divisor));

  return {
    cards: Math.min(max, Math.max(1, Math.min(facts * 2, byWords(6)))),
    quiz: Math.min(max, Math.max(1, Math.min(facts, byWords(8)))),
    exam: Math.min(max, Math.max(1, Math.min(facts, byWords(15)))),
  };
}
