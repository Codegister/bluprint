/**
 * Prompt rules for a set built from a syllabus scope instead of notes.
 *
 * Every generator also carries an instruction written for real source material:
 * "if the material does not state the fact, do not write the card", "every
 * answer must be stated in the material above", and so on. A syllabus scope
 * names what a qualification covers but never states the facts themselves, so
 * leaving those instructions in place tells the model to return an empty deck.
 * That is exactly the failure a course set saw: the outline went in, the model
 * obeyed the grounding instruction, and the build had nothing to store.
 *
 * These helpers keep the material-only rules for uploads and give the syllabus
 * path a coherent instruction instead. They are pure so the prompt contract can
 * be tested without a model call.
 */
export const SYLLABUS_CONTENT_SOURCE =
  "The text above is a scope, not teaching material: it names what the qualification covers but does not state the facts themselves. " +
  "Write the real subject content those topics call for from your knowledge of this qualification. " +
  "You may state facts the scope does not contain; never write about the specification itself.";

/** The content-not-qualification rule, without the material-only fallback. */
export function contentNotSpecRule(syllabus: boolean): string {
  const rule =
    "CONTENT, NOT THE QUALIFICATION: test one concrete subject fact or idea at a time. " +
    "Never ask what the specification, syllabus, exam board, paper, mark scheme or assessment objective says, covers, requires or rewards, and never ask how many marks, papers, hours or minutes. " +
    "A front asks one unambiguous question; its back answers only that question. " +
    "Do not repeat or reword an earlier item: a paraphrase of an existing question is still a repeat.";
  return syllabus
    ? rule
    : `${rule} If the material cannot support another distinct fact, return fewer items.`;
}

/** Whether a card may state a fact the source does not contain verbatim. */
export function cardSourceRule(syllabus: boolean): string {
  return syllabus
    ? "The scope names the topic but does not state the fact; write the fact the qualification requires."
    : "If the material does not state the fact, do not write the card.";
}

/** Where a quiz answer is allowed to come from. */
export function quizSourceRule(syllabus: boolean): string {
  return syllabus
    ? "Every answer must be a real fact from this qualification's subject content, not a line from the scope."
    : "Every answer must be stated in the material above.";
}

/** What an exam marking bullet must be supported by. */
export function examSourceRule(syllabus: boolean): string {
  return syllabus
    ? "Every bullet must be a real, separable point of subject knowledge for this qualification; the scope names topics but does not contain the facts, so write them yourself. Keep the question's marks equal to the bullets you write."
    : "Every bullet must be directly supported by the material above; never introduce a fact, example or mechanism the material does not contain. If the material cannot support the marks you planned, lower the question's marks so the bullets still add up exactly.";
}

/** What a summary must stay faithful to. */
export function summaryFidelityRule(syllabus: boolean): string {
  return syllabus
    ? "Be concrete and faithful to the subject content this qualification requires."
    : "Be concrete and faithful to the material.";
}
