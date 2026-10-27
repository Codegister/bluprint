/**
 * The detailed notes a course topic shows, and the one description of them.
 *
 * Two sources feed the notes tab:
 *
 *   - Cognito's published notes, when the course has a notes page (most
 *     subjects). Those are read, never written.
 *   - Bluprint's own notes, written with NVIDIA, for a course whose topics have
 *     no published notes at all: Edexcel GCSE Religious Studies (saved Pearson
 *     content, so there is no Cognito page) and AQA GCSE Spanish (Cognito only
 *     publishes the specification for it).
 *
 * Both are stored as the same section list, so the reader renders either one,
 * and the stored `origin` decides the wording under the heading. The parser
 * here is deliberately forgiving: a model response that arrives fenced, with
 * chatter around it, or with extra keys still becomes sections, and a response
 * with nothing usable falls back to the topic's own summary and key points
 * rather than leaving the tab empty.
 */

import { v } from "convex/values";

/** One printed note card: a heading and the prose under it. */
export type TopicNoteSection = { heading: string; blocks: string[] };

/**
 * The one description of a note section. Both the stored schema and the parser
 * use these limits, so a section can never be saved that the reader cannot
 * show in full.
 */
export const MAX_HEADING_CHARS = 160;
export const MAX_BLOCK_CHARS = 400;
export const MAX_NOTE_SECTIONS = 12;
export const MAX_BLOCKS_PER_SECTION = 14;

export const topicNoteSectionValidator = v.object({
  heading: v.string(),
  blocks: v.array(v.string()),
});

/** Where a stored copy of the notes came from. */
export type TopicNotesOrigin = "cognito" | "bluprint";

export const topicNotesOriginValidator = v.union(
  v.literal("cognito"),
  v.literal("bluprint"),
);

/** The topic fields the notes are written from. */
export type TopicNoteSource = {
  title: string;
  summary: string;
  keyPoints: string[];
  examSkill?: string;
};

function asText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

/** Removes reasoning blocks and code fences a model may wrap around its JSON. */
function stripNoise(raw: string): string {
  return raw
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Reads one JSON value out of a response, tolerating chatter and truncation. */
function readJson(raw: string): unknown {
  const text = stripNoise(raw);
  const candidates: string[] = [text];
  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    candidates.push(text.slice(objectStart, objectEnd + 1));
  }
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    candidates.push(text.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next shape.
    }
  }
  return null;
}

/** The keys a section's prose is normally written under. */
const PROSE_KEYS = [
  "blocks",
  "points",
  "content",
  "text",
  "body",
  "paragraphs",
  "items",
  "details",
  "notes",
];

/** A heading → prose map, which some replies use instead of a list. */
function rowsFromMap(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, prose]) => typeof prose === "string" || Array.isArray(prose),
  );
  return entries.length > 0
    ? entries.map(([heading, blocks]) => ({ heading, blocks }))
    : [];
}

/** The section rows inside whatever shape the model chose to answer with. */
function sectionRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["sections", "notes", "topics", "chapters"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
    const mapped = rowsFromMap(record[key]);
    if (mapped.length > 0) return mapped;
  }
  // A single section, written without the wrapper.
  if (typeof record.heading === "string" || typeof record.title === "string") {
    return [record];
  }
  // The whole object is a heading → prose map.
  return rowsFromMap(record);
}

/** Every string inside a value, however deeply it is nested. */
function proseFrom(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(proseFrom);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/^(?:heading|title|id|reference)$/i.test(key))
      .flatMap(([, nested]) => proseFrom(nested));
  }
  return [];
}

/**
 * One string of notes split into readable blocks.
 *
 * Models often answer with `"blocks": "one long paragraph"` instead of a list,
 * so that string is broken at sentence ends rather than cut at the character
 * limit: the notes stay complete and each block stays readable.
 */
function splitProse(text: string): string[] {
  const blocks: string[] = [];
  for (const chunk of text.split(/\n+/).map((part) => part.trim()).filter(Boolean)) {
    if (chunk.length <= MAX_BLOCK_CHARS) {
      blocks.push(chunk);
      continue;
    }
    let current = "";
    for (const sentence of chunk.match(/[^.!?]+[.!?]+["')\]]?\s*|[^.!?]+$/g) ?? [chunk]) {
      const piece = sentence.trim();
      if (!piece) continue;
      if (current && current.length + 1 + piece.length > MAX_BLOCK_CHARS) {
        blocks.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
    if (current) blocks.push(current);
  }
  return blocks;
}

/** The prose under one heading, whatever key or shape the model used. */
function blocksFor(row: Record<string, unknown>): string[] {
  const named = PROSE_KEYS.flatMap((key) =>
    row[key] === undefined ? [] : proseFrom(row[key]),
  );
  // A reply with its own key names still becomes notes: any nested string that
  // is not the heading counts as prose.
  const rest = Object.entries(row)
    .filter(([key]) => !PROSE_KEYS.includes(key) && !/^(?:heading|title)$/i.test(key))
    .flatMap(([, value]) => proseFrom(value));
  return (named.length > 0 ? named : rest)
    .flatMap(splitProse)
    .map((block) => asText(block, MAX_BLOCK_CHARS))
    .filter(Boolean)
    .slice(0, MAX_BLOCKS_PER_SECTION);
}

/** Trims and bounds a section list before it is stored or rendered. */
export function cleanSections(sections: TopicNoteSection[]): TopicNoteSection[] {
  return sections
    .map((section) => ({
      heading: asText(section.heading, MAX_HEADING_CHARS),
      blocks: section.blocks
        .map((block) => asText(block, MAX_BLOCK_CHARS))
        .filter(Boolean)
        .slice(0, MAX_BLOCKS_PER_SECTION),
    }))
    .filter((section) => section.heading.length > 0 && section.blocks.length > 0)
    .slice(0, MAX_NOTE_SECTIONS);
}

/**
 * The notes a topic always has, taken from the pathway entry itself. This is
 * what a subject falls back to when the model returns nothing usable, so no
 * course is ever left without a notes tab, and it is real content rather than
 * filler: the topic's own summary and key points.
 */
export function notesFromTopic(topic: TopicNoteSource): TopicNoteSection[] {
  const keyPoints = topic.keyPoints
    .map((point) => asText(point, MAX_BLOCK_CHARS))
    .filter(Boolean);
  const sections: TopicNoteSection[] = [];
  const summary = asText(topic.summary, MAX_BLOCK_CHARS);
  if (summary.length > 0) {
    sections.push({ heading: `What ${topic.title} covers`, blocks: [summary] });
  }
  if (keyPoints.length > 0) {
    sections.push({ heading: "What you need to know", blocks: keyPoints });
  }
  if (sections.length === 0) {
    sections.push({
      heading: topic.title,
      blocks: [
        `Read the published specification entry for ${topic.title} and turn each requirement into a short answer you could write from memory.`,
      ],
    });
  }
  return cleanSections(sections);
}

/** Key names and wrappers, which are structure rather than notes. */
const STRUCTURE_WORDS =
  /^(?:blocks?|points?|content|text|body|paragraphs?|items?|details|notes|sections?|heading|title)[\s\\n\[\]{}:]*$/i;

const KEY_WORDS =
  "blocks?|points?|content|text|body|paragraphs?|items?|details|notes|sections?|heading|title";

/**
 * A quoted key (`"blocks":`), or a bare key followed by a bracket — which is
 * what a reply with a broken key looks like (`"blocks[` with no closing quote).
 */
const KEY_NOISE = new RegExp(
  `"(?:${KEY_WORDS})"\\s*:?|\\b(?:${KEY_WORDS})\\b\\s*:?\\s*(?=[[\\]{},])`,
  "gi",
);

/**
 * The words left in a fragment once the JSON scaffolding is taken out: keys,
 * brackets, escapes and stray quotes are not part of the notes.
 */
/**
 * A key word left at the start of a fragment — the boundary cut can take the
 * quote in front of it with it, so `blocks:` arrives as plain `blocks:`.
 */
const LEADING_KEY = new RegExp(`^(?:${KEY_WORDS})\\b\\s*:?\\s*`, "i");

function tidyFragment(text: string): string {
  const cleaned = text
    .replace(KEY_NOISE, " ")
    .replace(/\\[nrt]/g, " ")
    .replace(/\\"/g, '"')
    .replace(/[{}\[\]]/g, " ")
    .replace(/"/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,:"']+/, "")
    .replace(/[\s,:"']+$/, "")
    .trim();
  return cleaned.replace(LEADING_KEY, "").replace(/^[\s,:"']+/, "").trim();
}

/**
 * A heading and its prose from one fragment of a broken reply. The model still
 * writes the comma and quotes between them, so that boundary is found before
 * any of the scaffolding is stripped.
 */
function salvageSection(fragment: string): { heading: string; prose: string } {
  // Only the opening of a fragment can hold a heading, so the boundary is
  // looked for there; a comma inside the notes is left alone.
  const boundary = /"\s*,\s*"?|"?\s*,\s*"/.exec(fragment.slice(0, 140));
  if (!boundary) return { heading: "", prose: tidyFragment(fragment) };
  return {
    heading: tidyFragment(fragment.slice(0, boundary.index)),
    prose: tidyFragment(fragment.slice(boundary.index + boundary[0].length)),
  };
}

/**
 * Where a section starts in a reply: the word "heading" after the brace, comma
 * or square bracket the reply opened, however its quotes and colons came out.
 */
const HEADING_MARKER = /(?:^|[{[,])\s*"?\s*heading\s*"?\s*:?\s*"?/gi;

/**
 * Notes recovered from a reply whose JSON is broken.
 *
 * A model mid-array sometimes writes `"blocks[` with no closing quote, or
 * `"heading "Title"` with the quotes the wrong way round, either of which makes
 * the whole document unparseable. The content is still there verbatim, so each
 * section is recovered from the text between two heading markers; a fragment
 * that lost its heading entirely is filed under the topic's own title rather
 * than thrown away.
 */
function salvageSections(
  raw: string,
  topic: TopicNoteSource,
): TopicNoteSection[] {
  const text = stripNoise(raw);
  const markers = [...text.matchAll(HEADING_MARKER)];
  const sections: TopicNoteSection[] = [];
  for (const [index, marker] of markers.entries()) {
    const start = (marker.index ?? 0) + marker[0].length;
    const stop = markers[index + 1]?.index ?? text.length;
    const recovered = salvageSection(text.slice(start, stop));
    // A heading is short and is not a sentence; anything else is already notes,
    // which are then filed under the topic's own title.
    const labelled =
      recovered.heading.length > 0 &&
      recovered.heading.length <= 100 &&
      !/[.!?]$/.test(recovered.heading);
    const heading = labelled ? recovered.heading : topic.title;
    const prose = labelled ? recovered.prose : tidyFragment(text.slice(start, stop));
    if (prose.length === 0) continue;
    const blocks = splitProse(prose)
      .map((block) => block.replace(/^["'\s]+/, "").replace(/["'\s,]+$/, "").trim())
      .filter((block) => block.length >= 12 && !STRUCTURE_WORDS.test(block));
    if (blocks.length > 0) sections.push({ heading, blocks });
  }
  return sections;
}

/**
 * Reads one model response into the notes for a topic. A reply that cannot be
 * read at all — broken JSON, or JSON with no sections in it — becomes the
 * topic's own summary and key points, so the caller always gets something to
 * store.
 */
export function parseTopicNotes(
  raw: string,
  topic: TopicNoteSource,
): TopicNoteSection[] {
  const rows = sectionRows(readJson(raw));
  const sections: TopicNoteSection[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const heading =
      asText(record.heading, MAX_HEADING_CHARS) ||
      asText(record.title, MAX_HEADING_CHARS);
    const blocks = blocksFor(record);
    if (!heading || blocks.length === 0) continue;
    sections.push({ heading, blocks });
  }
  const cleaned = cleanSections(sections);
  if (cleaned.length > 0) return cleaned;
  const salvaged = cleanSections(salvageSections(raw, topic));
  return salvaged.length > 0 ? salvaged : notesFromTopic(topic);
}
