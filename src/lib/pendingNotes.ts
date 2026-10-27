/**
 * Notes typed into the landing hero, handed to the app after sign-in.
 *
 * A visitor can paste their notes before they have an account. The text is
 * carried in sessionStorage (per tab, cleared on use) so the words they pasted
 * are still there when the create dialog opens, instead of being thrown away.
 */

import { MAX_NOTE_CHARS } from "@/convex/lib/noteLimits";

const KEY = "bluprint:pending-notes";

/** Keeps the pasted notes for this tab only, and only until they are used. */
export function savePendingNotes(notes: string): void {
  try {
    // The same limit as the paste box and the server, from one constant.
    window.sessionStorage.setItem(KEY, notes.slice(0, MAX_NOTE_CHARS));
  } catch {
    // Private mode or a full store: the visitor can paste again on the
    // dashboard, so this must never break navigation.
  }
}

/** Takes the saved notes, clearing them so they are only used once. */
export function takePendingNotes(): string | null {
  try {
    const value = window.sessionStorage.getItem(KEY);
    if (value === null) return null;
    window.sessionStorage.removeItem(KEY);
    return value.trim().length >= 40 ? value : null;
  } catch {
    return null;
  }
}
