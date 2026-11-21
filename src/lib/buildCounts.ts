import {
  materialLimits,
  type MaterialLimits,
} from "@/convex/lib/buildCapacity";
import {
  BUILD_DEFAULTS,
  BUILD_MAX,
  BUILD_MIN,
} from "@/convex/lib/buildDefaults";

/** The set fields the edit-counts dialog needs. */
export type BuildCountSet = {
  courseId?: unknown;
  notes: string;
  targetCardCount?: number;
  targetQuizCount?: number;
  targetExamCount?: number;
};

/**
 * The highest value each count slider may offer for this set's next rebuild.
 *
 * This mirrors `planForSet` in `convex/ai.ts`: a course set is generated from
 * its pathway, whose text only names the scope, so its length is not a ceiling.
 * Using `materialLimits` for every set clamped a tutor build's 100-card request
 * to the syllabus text's much lower limit, which stored the clamped number and
 * left the slider pinned at the end of a short track.
 */
export function buildCountLimits(set: BuildCountSet): MaterialLimits {
  if (set.courseId !== undefined) {
    return { cards: BUILD_MAX, quiz: BUILD_MAX, exam: BUILD_MAX };
  }
  const limits = materialLimits(set.notes);
  return {
    cards: Math.max(BUILD_MIN, limits.cards),
    quiz: Math.max(BUILD_MIN, limits.quiz),
    exam: Math.max(BUILD_MIN, limits.exam),
  };
}

/**
 * The counts the dialog opens with: the stored targets, held inside the
 * slider's ceiling. The ceiling only binds when the material really cannot
 * support the target, which is the case the sliders describe.
 */
export function initialBuildCounts(set: BuildCountSet): {
  cards: number;
  quiz: number;
  exam: number;
} {
  const limits = buildCountLimits(set);
  return {
    cards: Math.min(set.targetCardCount ?? BUILD_DEFAULTS.cards, limits.cards),
    quiz: Math.min(set.targetQuizCount ?? BUILD_DEFAULTS.quiz, limits.quiz),
    exam: Math.min(set.targetExamCount ?? BUILD_DEFAULTS.exam, limits.exam),
  };
}
