/**
 * Reads a PowerPoint deck in the browser.
 *
 * A `.pptx` is a ZIP of XML, so a deck's words can be pulled out without a
 * renderer, without an extra dependency and without uploading the file: the
 * slide text simply becomes the set's notes, the same way pasted notes do.
 * Pictures and SmartArt the deck draws stay behind, so a deck that is only
 * images is refused with a message instead of producing an empty set.
 */

/** The one place PowerPoint keeps its slides in a deck's archive. */
const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;

/** A deck larger than this is refused before anything is decompressed. */
export const MAX_DECK_BYTES = 100 * 1024 * 1024;

export type PptxDeck = {
  /** The slides' text, one `Slide N` heading per slide that has any. */
  text: string;
  /** Slides in the deck, in the order PowerPoint shows them. */
  slideCount: number;
  /** Slides that actually carried readable text. */
  textSlides: number;
};

type ZipEntry = {
  name: string;
  /** Where the entry's local header starts. */
  offset: number;
  /** Compressed size, as written in the central directory. */
  size: number;
  /** 0 = stored, 8 = deflate; a deck uses one or the other. */
  method: number;
};

function notADeck(): Error {
  return new Error(
    "That file isn't a PowerPoint deck. Save it as a .pptx from PowerPoint or Google Slides and try again.",
  );
}

/**
 * Reads the central directory, which is the only reliable index in a ZIP: it
 * carries each entry's real name, size and offset, even when the local header
 * was written before those were known.
 */
function readDirectory(view: DataView, bytes: Uint8Array): ZipEntry[] {
  // The end-of-central-directory record sits at the end, after a comment that
  // can be up to 64 KB long, so search back from the tail for its signature.
  let end = -1;
  const first = Math.max(0, bytes.length - 22 - 0xffff);
  for (let at = bytes.length - 22; at >= first; at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw notADeck();

  const count = view.getUint16(end + 10, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (directoryOffset === 0xffffffff) {
    throw new Error("That deck is too large for Bluprint to read. Try a copy saved from PowerPoint as a .pptx.");
  }

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length) break;
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    if (size === 0xffffffff || offset === 0xffffffff) {
      throw new Error("That deck is too large for Bluprint to read. Try a copy saved from PowerPoint as a .pptx.");
    }
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    entries.push({ name, offset, size, method });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** One archive entry as text. Only the two compression methods Office writes. */
async function readEntry(
  view: DataView,
  bytes: Uint8Array,
  entry: ZipEntry,
): Promise<string> {
  if (view.getUint32(entry.offset, true) !== 0x04034b50) throw notADeck();
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  // A copy, not a view: it is all that is needed for this entry, and it keeps
  // the Blob below off a buffer the deck's other reads still share.
  const body = bytes.slice(start, start + entry.size);
  if (entry.method === 0) return new TextDecoder().decode(body);
  if (entry.method !== 8) {
    throw new Error(
      "That deck is saved with a compression Bluprint can't open. Save a fresh .pptx from PowerPoint and try again.",
    );
  }
  const stream = new Blob([body])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&");
}

/**
 * The words on one slide. Each drawing paragraph is one bullet, and every text
 * run inside it is joined without a separator because PowerPoint splits a
 * single sentence across runs when the formatting changes mid-sentence.
 *
 * Bullets are separated with a visible `•` rather than a line break: the stored
 * notes collapse whitespace, which would otherwise weld a whole deck of
 * fragments into one sentence. The bullet also lets the build estimate count
 * each slide point as the separate fact it is.
 */
function slideText(xml: string): string {
  return xml
    .split(/<\/a:p>/)
    .map((paragraph) => {
      const runs = paragraph.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g);
      return [...runs]
        .map((run) => decodeXml(run[1] ?? ""))
        .join("")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(Boolean)
    .join(" • ");
}

function slideNumber(name: string): number {
  return Number(SLIDE_PATH.exec(name)?.[1] ?? 0);
}

/**
 * Slides in the order the deck shows them, not in file-name order: a deck whose
 * slides were reordered keeps `slide1.xml` wherever it was created. The
 * presentation part lists slide ids, and its relationships map those ids to the
 * slide files. Anything the list misses is appended in numeric order, so a
 * deck with unusual relationships still gives up all of its text.
 */
function orderSlides(
  names: string[],
  presentation: string,
  relationships: string,
): string[] {
  const targets = new Map<string, string>();
  for (const tag of relationships.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = /\bId="([^"]+)"/.exec(tag)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(tag)?.[1];
    if (!id || !target) continue;
    const path = `ppt/${target.replace(/^\/?ppt\//, "").replace(/^\//, "")}`;
    if (SLIDE_PATH.test(path)) targets.set(id, path);
  }

  const ordered: string[] = [];
  const known = new Set(names);
  for (const tag of presentation.match(/<p:sldId\b[^>]*>/g) ?? []) {
    const id = /\br:id="([^"]+)"/.exec(tag)?.[1];
    const path = id ? targets.get(id) : undefined;
    if (path && known.has(path) && !ordered.includes(path)) ordered.push(path);
  }
  for (const name of [...names].sort((a, b) => slideNumber(a) - slideNumber(b))) {
    if (!ordered.includes(name)) ordered.push(name);
  }
  return ordered;
}

/**
 * Extracts a deck's slide text. Throws with a sentence a student can act on:
 * an old binary `.ppt`, a renamed document, or a deck with no words at all.
 */
export async function readPptxDeck(input: Blob): Promise<PptxDeck> {
  if (input.size > MAX_DECK_BYTES) {
    throw new Error(
      "That PowerPoint is over 100 MB. Try a smaller deck or upload photos of the slides instead.",
    );
  }
  const bytes = new Uint8Array(await input.arrayBuffer());
  if (bytes.length < 22) throw notADeck();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) throw notADeck();

  const entries = readDirectory(view, bytes);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const slideNames = entries
    .filter((entry) => SLIDE_PATH.test(entry.name))
    .map((entry) => entry.name);
  if (slideNames.length === 0) {
    throw new Error(
      "That .pptx has no slides Bluprint can read. If it is an older .ppt, open it in PowerPoint and save a copy as .pptx.",
    );
  }

  const presentation = byName.get("ppt/presentation.xml");
  const relationships = byName.get("ppt/_rels/presentation.xml.rels");
  const ordered =
    presentation && relationships
      ? orderSlides(
          slideNames,
          await readEntry(view, bytes, presentation),
          await readEntry(view, bytes, relationships),
        )
      : [...slideNames].sort((a, b) => slideNumber(a) - slideNumber(b));

  const blocks: string[] = [];
  let textSlides = 0;
  for (const [index, name] of ordered.entries()) {
    const entry = byName.get(name);
    if (!entry) continue;
    const text = slideText(await readEntry(view, bytes, entry));
    if (!text) continue;
    textSlides += 1;
    blocks.push(`Slide ${index + 1}\n${text}`);
  }

  return {
    text: blocks.join("\n\n"),
    slideCount: ordered.length,
    textSlides,
  };
}
