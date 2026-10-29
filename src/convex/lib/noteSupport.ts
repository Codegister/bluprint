/**
 * Deterministic grounding for generated marking guides.
 *
 * A prompt can ask the model to use only the student's notes, but a prompt is
 * not a guarantee. This check compares each bullet's own subject terms with the
 * note's terms and drops a bullet that introduces a requirement the note cannot
 * support. That matters most for exam questions: a student should never lose a
 * mark for failing to state a fact their notes never contained.
 *
 * The check is deliberately conservative. A bullet written with a synonym the
 * notes do not use is dropped too; losing a criterion is better than marking a
 * student down against material they were never given.
 */
import { criterionKeywords } from "./markingCriteria";

function keywordSet(text: string): Set<string> {
  return new Set(criterionKeywords(text));
}

/** True when every subject term in the bullet is present in the notes. */
export function isSupportedByNotes(notes: string, bullet: string): boolean {
  const wanted = criterionKeywords(bullet);
  if (wanted.length === 0) return false;
  const available = keywordSet(notes);
  return wanted.every((word) => available.has(word));
}

/** Keeps only the marking-guide bullets the student's notes can support. */
export function filterGuideToNotes(notes: string, guide: string[]): string[] {
  return guide.filter((bullet) => isSupportedByNotes(notes, bullet));
}
