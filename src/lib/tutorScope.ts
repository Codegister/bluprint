/**
 * The tutor's web scope: what the chip is set to, what the last reply actually
 * used, and the sentence under the composer.
 *
 * The caption used to read "web search is off" while the Web chip sat switched
 * on beside it. Now the caption is derived from what really happened to the
 * last answer, so it can never contradict the control.
 */

import { plural } from "@/lib/format";

/** Where a set's web choice is remembered, so it survives a reload. */
export function tutorWebScopeKey(setId: string): string {
  return `bluprint:tutor-web:${setId}`;
}

/** Reads a remembered choice; anything unreadable means notes-only. */
export function readTutorWebScope(setId: string | null | undefined): boolean {
  if (!setId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(tutorWebScopeKey(setId)) === "on";
  } catch {
    // Private mode and blocked storage both throw; notes-only is the safe default.
    return false;
  }
}

/** Remembers the choice for this set. */
export function saveTutorWebScope(setId: string, useWeb: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tutorWebScopeKey(setId), useWeb ? "on" : "off");
  } catch {
    // Storage is a convenience here, never a requirement.
  }
}

/**
 * The sentence under the composer.
 *
 * `latestSourceCount` is the number of pages cited by the most recent finished
 * answer, or null when no answer has been given yet in this thread — which is
 * what keeps the caption from announcing sources before a search has run.
 */
export function tutorScopeCaption(options: {
  useWeb: boolean;
  /** "this set's notes" or "this course's notes". */
  materialLabel: string;
  latestSourceCount: number | null;
}): string {
  const { useWeb, materialLabel, latestSourceCount } = options;
  if (!useWeb) return `Answering from ${materialLabel}.`;
  if (latestSourceCount === null) {
    return "Web is on: the tutor will search for this question and cite the pages it uses.";
  }
  if (latestSourceCount > 0) {
    return `Answering from ${materialLabel} and ${plural(latestSourceCount, "web source")}.`;
  }
  return `No useful web source was found, so this answer comes from ${materialLabel} only.`;
}
