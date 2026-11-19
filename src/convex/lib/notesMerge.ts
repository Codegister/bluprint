/**
 * Combining the two published notes sources.
 *
 * Save My Exams and Cognito both publish revision notes for the same courses,
 * but neither covers every topic. Bluprint reads both and merges what it gets:
 * Save My Exams' exam-board-specific cards come first, then Cognito's cards
 * fill the remaining slots. A guide is never shown twice just because both
 * sites wrote one: headings (or, for generic headings such as "Overview", the
 * first sentence under them) are de-duplicated.
 */

import type { TopicNoteSection } from "./topicNotes";

export type NotesCitation = { title: string; url: string };

export type NotesRead = {
  sections: TopicNoteSection[];
  sources: NotesCitation[];
  /** A request failed; the other source may still have answered. */
  failed: boolean;
};

const EMPTY_READ: NotesRead = { sections: [], sources: [], failed: false };

export function emptyNotesRead(): NotesRead {
  return { ...EMPTY_READ, sections: [], sources: [] };
}

function textKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * What makes two cards the same guide. A specific heading is enough; a generic
 * one ("Overview", "Key points") is only the same when the prose also matches.
 */
function sectionKeys(section: TopicNoteSection): string[] {
  const heading = textKey(section.heading);
  const keys = heading ? [`h:${heading}`] : [];
  if (heading.length < 12 || /^(overview|summary|key points|introduction)$/.test(heading)) {
    const prose = textKey(section.blocks[0] ?? "").slice(0, 90);
    if (prose) keys.push(`b:${prose}`);
  }
  return keys;
}

function dedupeSections(sections: TopicNoteSection[]): TopicNoteSection[] {
  const seen = new Set<string>();
  const kept: TopicNoteSection[] = [];
  for (const section of sections) {
    const keys = sectionKeys(section);
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    kept.push(section);
  }
  return kept;
}

/**
 * Merges the two reads into one card list.
 *
 * The primary source keeps its first `primaryLimit` cards, so its exam-board
 * wording leads and a full primary read is not replaced page for page. The
 * secondary source then fills the remaining slots, which is what makes a
 * combined read useful rather than a duplicate of the primary. When only one
 * source answered, its cards use the full `totalLimit`.
 */
export function mergeNoteSections(
  primary: TopicNoteSection[],
  secondary: TopicNoteSection[],
  options: { primaryLimit?: number; totalLimit?: number } = {},
): TopicNoteSection[] {
  const total = Math.max(1, options.totalLimit ?? 12);
  const primaryLimit = Math.min(total, Math.max(1, options.primaryLimit ?? total));
  const lead = dedupeSections(primary).slice(0, primaryLimit);
  const rest = dedupeSections([...lead, ...secondary]);
  return rest.slice(0, total);
}

/** Merges the two citations, keeping one entry per page. */
export function mergeCitations(
  primary: NotesCitation[],
  secondary: NotesCitation[],
): NotesCitation[] {
  const seen = new Set<string>();
  const kept: NotesCitation[] = [];
  for (const citation of [...primary, ...secondary]) {
    if (!citation.url || seen.has(citation.url)) continue;
    seen.add(citation.url);
    kept.push(citation);
  }
  return kept;
}

/** The two reads as one, with the source that answered marked on each read. */
export function mergeNotesReads(
  primary: NotesRead,
  secondary: NotesRead,
  options: { primaryLimit?: number; totalLimit?: number } = {},
): NotesRead {
  return {
    sections: mergeNoteSections(primary.sections, secondary.sections, options),
    sources: mergeCitations(primary.sources, secondary.sources),
    failed: primary.failed && secondary.failed,
  };
}
