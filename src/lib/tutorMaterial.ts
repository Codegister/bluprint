/**
 * Whether a finished tutor reply should offer to become a study set.
 *
 * The tutor recognises a request for study material as intent, not as one
 * trigger phrase: "turn these notes into a set", "summarise this page" or
 * "give me the key points" all produce material worth keeping. The chat then
 * shows a "Turn into a study set" button under that reply. The decision lives
 * here, next to the answer, so the set, course and home tutors all agree.
 */

import { materialLimits } from "@/convex/lib/buildCapacity";
import { BUILD_DEFAULTS } from "@/convex/lib/buildDefaults";
import { MIN_NOTE_CHARS } from "@/convex/lib/noteLimits";
import { isStudyMaterialOffer } from "@/convex/lib/tutorAgent";

type TutorTurn = { role: string; content: string; streaming?: boolean };

/** The student's question a reply answered: the nearest earlier user turn. */
export function questionForReply(
  turns: readonly TutorTurn[],
  index: number,
): string | null {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const turn = turns[cursor];
    if (turn?.role === "user" && turn.content.trim()) return turn.content.trim();
  }
  return null;
}

/**
 * True when `turns[index]` is a finished assistant reply that should offer a
 * set. A reply that already links the sets it built never offers another, and
 * a reply too short to produce cards is not offered either.
 */
export function offersStudySet(
  turns: readonly TutorTurn[],
  index: number,
  builtSetIds: readonly string[] = [],
): boolean {
  const reply = turns[index];
  if (!reply || reply.role !== "assistant" || reply.streaming) return false;
  if (builtSetIds.length > 0) return false;
  if (reply.content.trim().length < MIN_NOTE_CHARS) return false;
  const question = questionForReply(turns, index);
  return question !== null && isStudyMaterialOffer(question);
}

/**
 * The counts a reply should build.
 *
 * The tutor writes as much material as the question needs, so the fixed 10/5/3
 * defaults dropped most of a longer reply. Flashcards and quiz questions are
 * equal, one per fact the reply can support, and the same material ceiling the
 * generator applies is used here so the two sections stay equal after the
 * build is capped.
 */
export function tutorReplyCounts(notes: string): {
  cards: number;
  quiz: number;
  exam: number;
} {
  const limits = materialLimits(notes);
  return {
    cards: limits.quiz,
    quiz: limits.quiz,
    exam: Math.min(BUILD_DEFAULTS.exam, limits.exam),
  };
}
