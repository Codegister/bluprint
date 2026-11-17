/**
 * What the tutor is told after it acted on a build request.
 *
 * The notes live here, apart from the action, so the wording is fixed by a
 * test: every level of the tutor is told that a set exists, that it must not
 * answer a build request by pasting flashcards into the chat, and which sets
 * were created when one request builds every course.
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

/** The counts every note quotes, so the student knows what was requested. */
function targetCounts(plan: TutorBuildPlan): string {
  return `${plan.counts.cards} flashcards, ${plan.counts.quiz} quiz questions and ${plan.counts.exam} exam questions`;
}

/** What the tutor should say about one started build. */
export function tutorBuildNote(outcome: TutorBuildOutcome): string {
  const { plan, cached, created, started, failure } = outcome;
  if (failure || !outcome.setId) {
    return (
      `The student asked you to build ${plan.subject}: ${plan.label}, but the build did not start. ` +
      `The reason is: ${failure ?? "I couldn't start that build. Nothing was charged."} ` +
      `Do not claim anything was built. ${NO_MATERIAL_IN_CHAT} Tell them what happened and what to do next.`
    );
  }
  if (cached) {
    return (
      `A study set for ${plan.subject}: ${plan.label} has been created and is ready to study now. ` +
      `It was built for ${targetCounts(plan)}. ` +
      "It reused a finished build, so no generation is running. In your first sentence, say it is ready, not building. " +
      "Do not ask for confirmation or claim anything is still generating. Then answer any remaining part of their request."
    );
  }
  if (created) {
    return started
      ? `A study set has already been created and its background build has started for ${plan.subject}: ${plan.label}. ` +
          `Its target is ${targetCounts(plan)}. ` +
          "In your first sentence, say you have built it and started it. Do not ask for confirmation. " +
          "Say it is building now, not ready, and do not claim the cards or questions are finished. " +
          "Then answer any remaining part of their request with a short explanation or one practice question."
      : `A study set has been created for ${plan.subject}: ${plan.label}, but its background build could not be queued. ` +
          "Tell them the set is saved and they can open it to start the build. Do not claim it is already building.";
  }
  return (
    `A study set covering ${plan.subject}: ${plan.label} already exists. ` +
    "In your first sentence, tell them it is already in their library. Do not claim a new build was started. " +
    "Then answer any remaining part of their request."
  );
}

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
