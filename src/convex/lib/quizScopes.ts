/**
 * Splits a pathway brief into the sections a quiz can be generated against.
 *
 * A whole-subject brief can contain thirty topics and thousands of words. Asking
 * one model call for a hundred questions from that block encourages a shallow
 * pass: the model writes a handful, the caller retries the same enormous prompt,
 * and the build finishes with almost nothing. Generating against one section at
 * a time keeps each call small enough to finish and makes the batch cover the
 * whole pathway instead of repeating the first few facts.
 */

export type PathwayQuizScope = {
  /** The section title, used in the batch prompt and the server log. */
  label: string;
  /** The shared course preamble plus this section's lines. */
  notes: string;
  /** How many questions this section should contribute. */
  target: number;
};

const SECTION_HEADING = /^(?:Section\s+\d+:|Topic:)\s*(.+)$/i;

/**
 * The one way a pathway brief is divided for quiz generation.
 *
 * A target smaller than the number of sections uses one section per question.
 * Otherwise every section gets a ceiling of the per-section share; the extra
 * capacity is deliberately left in place so duplicates found after merging do
 * not immediately turn a complete build into a short one.
 */
/** Exams use the same section boundaries as quizzes. */
export const pathwaySectionScopes = pathwayQuizScopes;

export function pathwayQuizScopes(
  notes: string,
  target: number,
): PathwayQuizScope[] {
  const clean = notes.trim();
  const count = Math.max(0, Math.floor(target));
  if (!clean || count === 0) return [];

  const preamble: string[] = [];
  const sections: Array<{ label: string; lines: string[] }> = [];
  let current: { label: string; lines: string[] } | null = null;

  for (const line of clean.split(/\r?\n/)) {
    const heading = line.match(SECTION_HEADING);
    if (heading) {
      current = { label: heading[1]!.trim(), lines: [line] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  if (sections.length === 0) {
    return [{ label: "the pathway", notes: clean, target: count }];
  }

  // A small request should not spend a call on every section just because the
  // pathway is long. A full request uses every section, with enough spare
  // questions to survive cross-section deduplication.
  const active =
    count < sections.length ? sections.slice(0, count) : sections;
  // Leave four spare questions per section. Cross-section deduplication, the
  // card-overlap check, shared-answer checks and the teaching-quality check all
  // run after merging, so generating exactly the nominal share would make
  // legitimate collisions look like a failed build.
  const perSection =
    count <= active.length ? 1 : Math.ceil(count / active.length) + 4;

  return active.map((section) => ({
    label: section.label,
    notes: [...preamble, ...section.lines].join("\n").trim(),
    target: Math.min(perSection, count),
  }));
}
