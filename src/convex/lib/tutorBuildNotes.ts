/**
 * What the tutor is told after it acted on a build request.
 *
 * The notes live here, apart from the action, so the wording is fixed by a
 * test: the tutor is told which confirmed sets were created and whether each is
 * building or ready, and a course that could not start is named without hiding
 * the courses that did.
 */

import type { TutorBuildPlan } from "./tutorAgent";

/** Do not let a model answer a build request with set content instead of a set. */
export const NO_MATERIAL_IN_CHAT =
  "Do not write flashcards, quiz questions or study-set content into the chat.";

/** One course's share of a tutor build, whether it started or why it did not. */
export type TutorBuildOutcome<TId extends string = string> = {
  plan: TutorBuildPlan;
  setId?: TId;
  created: boolean;
  cached: boolean;
  started: boolean;
  failure?: string;
};

/** The state of one course's build, in the words the student will hear. */
function stateOf(outcome: TutorBuildOutcome): string {
  if (outcome.cached) return "ready to study now";
  if (outcome.started) return "building now";
  return "saved, open it to start the build";
}

/** The failure lines, with the course named so a partial batch is clear. */
function failureLine(outcomes: TutorBuildOutcome[]): string {
  return outcomes
    .map((outcome) => `${outcome.plan.subject} — ${outcome.failure ?? "could not start"}`)
    .join("; ");
}

/**
 * What the tutor is told when one request asked for a set from every course.
 *
 * Every created set is returned so the reply can link each one, and a course
 * that could not start is named without hiding the courses that did.
 */
export function multiBuildNote<TId extends string>(
  outcomes: TutorBuildOutcome<TId>[],
): { note: string; builtSetIds: TId[] } {
  const built = outcomes.filter(
    (outcome): outcome is TutorBuildOutcome<TId> & { setId: TId } =>
      outcome.setId !== undefined,
  );
  const failed = outcomes.filter((outcome) => outcome.setId === undefined);

  if (built.length === 0) {
    return {
      note:
        "The student asked for a set from each of their courses, but no build could start. " +
        `Do not claim anything was built. ${NO_MATERIAL_IN_CHAT} ` +
        `Tell them: ${failureLine(outcomes)}.`,
      builtSetIds: [],
    };
  }

  const created = built
    .map(
      (outcome) =>
        `${outcome.plan.subject}: ${outcome.plan.label} (${stateOf(outcome)})`,
    )
    .join("; ");
  const failedNote =
    failed.length > 0 ? ` These could not start: ${failureLine(failed)}.` : "";

  return {
    note:
      `The student asked for a set from each of their courses. The tutor has already created these sets: ${created}.${failedNote} ` +
      "In one short sentence per set, say what was built and whether it is building or ready. Do not ask for confirmation. " +
      NO_MATERIAL_IN_CHAT,
    builtSetIds: built.map((outcome) => outcome.setId),
  };
}
