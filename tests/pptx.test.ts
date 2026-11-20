import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { readPptxDeck } from "../src/lib/pptx";

/**
 * A ZIP writer for the fixture only: a real deck is written by PowerPoint, but
 * these tests need to control entry order, compression and slide numbering. CRC
 * fields are left at zero because the reader never checks them.
 */
function zip(
  files: Array<{ name: string; content: string }>,
  compress: boolean,
): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const headers: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const raw = encoder.encode(file.content);
    const body = compress ? new Uint8Array(deflateRawSync(raw)) : raw;
    const method = compress ? 8 : 0;

    const local = new Uint8Array(30 + name.length + body.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, method, true);
    localView.setUint32(18, body.length, true);
    localView.setUint32(22, raw.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(body, 30 + name.length);
    locals.push(local);

    const header = new Uint8Array(46 + name.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, 0x02014b50, true);
    headerView.setUint16(4, 20, true);
    headerView.setUint16(6, 20, true);
    headerView.setUint16(10, method, true);
    headerView.setUint32(20, body.length, true);
    headerView.setUint32(24, raw.length, true);
    headerView.setUint16(28, name.length, true);
    headerView.setUint32(42, offset, true);
    header.set(name, 46);
    headers.push(header);

    offset += local.length;
  }

  const directorySize = headers.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, offset, true);

  const out = new Uint8Array(offset + directorySize + end.length);
  let at = 0;
  for (const part of [...locals, ...headers, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** One slide part with its paragraphs as drawing text runs. */
function slide(lines: string[]): string {
  const body = lines
    .map(
      (line) =>
        `<p:sp><p:txBody><a:p><a:r><a:t>${line}</a:t></a:r></a:p></p:txBody></p:sp>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;
}

const PRESENTATION = `<?xml version="1.0"?><p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`;
const PRESENTATION_RELS = `<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="slide" Target="slides/slide2.xml"/></Relationships>`;

function deck(compress: boolean, slides: Array<{ name: string; xml: string }>) {
  return zip(
    [
      { name: "ppt/presentation.xml", content: PRESENTATION },
      { name: "ppt/_rels/presentation.xml.rels", content: PRESENTATION_RELS },
      { name: "[Content_Types].xml", content: "<Types/>" },
      ...slides.map((entry) => ({ name: entry.name, content: entry.xml })),
    ],
    compress,
  );
}

describe("PowerPoint text", () => {
  test("reads deflated slide text in the order the deck shows it", async () => {
    const bytes = deck(true, [
      { name: "ppt/slides/slide1.xml", xml: slide(["First slide", "Osmosis"]) },
      {
        name: "ppt/slides/slide2.xml",
        xml: slide(["Second slide", "Water moves &amp; sugar follows"]),
      },
    ]);

    const parsed = await readPptxDeck(new Blob([bytes]));
    expect(parsed.slideCount).toBe(2);
    expect(parsed.textSlides).toBe(2);
    // rId3 (slide2) is listed first by the presentation, so it is slide 1.
    expect(parsed.text).toBe(
      "Slide 1\nSecond slide • Water moves & sugar follows\n\nSlide 2\nFirst slide • Osmosis",
    );
  });

  test("reads stored entries and keeps each paragraph as its own bullet", async () => {
    const bytes = deck(false, [
      { name: "ppt/slides/slide1.xml", xml: slide(["Only slide", "Second point"]) },
      { name: "ppt/slides/slide2.xml", xml: slide(["Other slide"]) },
    ]);

    const parsed = await readPptxDeck(new Blob([bytes]));
    // Bullets, not line breaks: stored notes collapse whitespace, and a deck of
    // fragments must not read as one long sentence to the build estimator.
    expect(parsed.text).toBe("Slide 1\nOther slide\n\nSlide 2\nOnly slide • Second point");
  });

  test("a deck of pictures yields no text rather than invented words", async () => {
    const bytes = deck(false, [
      { name: "ppt/slides/slide1.xml", xml: slide([]) },
    ]);

    const parsed = await readPptxDeck(new Blob([bytes]));
    expect(parsed.textSlides).toBe(0);
    expect(parsed.text).toBe("");
  });

  test("refuses a file that is not an archive", async () => {
    const bytes = new TextEncoder().encode("this is not a powerpoint file at all");
    await expect(readPptxDeck(new Blob([bytes]))).rejects.toThrow(/PowerPoint/);
  });

  test("refuses a zip that is not a deck", async () => {
    const bytes = zip(
      [{ name: "word/document.xml", content: "<document>essay</document>" }],
      true,
    );
    await expect(readPptxDeck(new Blob([bytes]))).rejects.toThrow(/no slides/);
  });
});
