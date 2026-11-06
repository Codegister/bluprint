/**
 * Course sets are built from a syllabus outline, not from teaching material.
 *
 * The brief names the scope of a qualification and the generator is told to
 * write the subject content itself (see PATHWAY_MATERIAL_RULES in ai.ts). That
 * makes grounding a generated fact in the brief impossible: the brief contains
 * the topic's name, not the fact. The note checks therefore have to recognise
 * the outline and stand down, or they reject everything the set is meant to
 * teach.
 *
 * The header is exported so the function that writes the brief and the checks
 * that read it cannot drift apart.
 */
export const SYLLABUS_SCOPE_HEADER = "Syllabus scope for this set:";

/** Whether these notes are a course scope brief rather than source material. */
export function isSyllabusOutline(notes: string): boolean {
  return notes.includes(SYLLABUS_SCOPE_HEADER);
}
