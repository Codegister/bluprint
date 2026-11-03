/**
 * Keeps practice papers varied and free of near-duplicate questions.
 *
 * The model sees one question slot at a time, so it has no natural memory of
 * the questions already written. These helpers give it a stable per-build topic
 * order and a conservative check for two slots that ask the same thing with
 * different mark tariffs.
 */

const TASK_WORDS = new Set([
  "about",
  "and",
  "answer",
  "answers",
  "belief",
  "beliefs",
  "example",
  "examples",
  "explain",
  "for",
  "from",
  "give",
  "giving",
  "how",
  "in",
  "including",
  "into",
  "of",
  "on",
  "or",
  "outline",
  "point",
  "points",
  "practice",
  "practices",
  "reason",
  "reasons",
  "referring",
  "religious",
  "source",
  "sources",
  "student",
  "students",
  "teaching",
  "teachings",
  "the",
  "their",
  "this",
  "to",
  "two",
  "using",
  "what",
  "which",
  "with",
  "write",
  "your",
]);

/** A stable, testable shuffle so a paper build can choose a fresh topic order. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const shuffled = [...items];
  let state = seed >>> 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
  }
  return shuffled;
}

/** FNV-1a, used to turn a paper id and build time into a stable seed. */
export function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stem(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

/** The subject matter of a question, with its task wording removed. */
export function questionFocus(question: string): Set<string> {
  const focus = question
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    // "…, giving a reason or example for each" and similar trailing task
    // clauses are not what makes two questions the same question.
    .replace(
      /,\s*(?:giving|referring|using|including|with|and give|and refer|for example|such as)\b.*$/i,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return new Set(
    focus
      .split(/\s+/)
      .filter((word) => word.length > 2 && !TASK_WORDS.has(word))
      .map(stem),
  );
}

/**
 * True when two questions share the same focus. The threshold is deliberately
 * high: a paper may legitimately ask about two different beliefs from one
 * topic, but it should never turn one stem into a 4-mark and 5-mark version.
 */
export function questionsTooSimilar(left: string, right: string): boolean {
  const first = questionFocus(left);
  const second = questionFocus(right);
  if (first.size < 3 || second.size < 3) {
    return left.toLowerCase().replace(/\s+/g, " ").trim() ===
      right.toLowerCase().replace(/\s+/g, " ").trim();
  }

  const shared = [...first].filter((word) => second.has(word)).length;
  const smaller = Math.min(first.size, second.size);
  const union = new Set([...first, ...second]).size;
  return (
    shared >= 3 &&
    (shared / smaller >= 0.8 || shared / union >= 0.6)
  );
}
