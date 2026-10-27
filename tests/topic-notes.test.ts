import { describe, expect, test } from "bun:test";

import {
  MAX_BLOCK_CHARS,
  MAX_NOTE_SECTIONS,
  cleanSections,
  notesFromTopic,
  parseTopicNotes,
} from "../src/convex/lib/topicNotes";

const TOPIC = {
  title: "Popular culture",
  summary: "Covers music, cinema and television, and food and drink.",
  keyPoints: [
    "Name the genres of music and film that come up in the exam.",
    "Use the past tense to describe what you watched.",
  ],
  examSkill: "Answer in the target language, with reasons.",
};

describe("topic notes", () => {
  test("a fenced response with extra keys still becomes sections", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        sections: [
          { heading: "Music and film", title: "ignored", blocks: ["Reggaeton is popular.", "El cine."] },
          { heading: "Food and drink", blocks: ["Tapas are small plates."], extra: true },
        ],
        footer: "ignored",
      }) +
      "\n```";
    const sections = parseTopicNotes(raw, TOPIC);

    expect(sections.map((section) => section.heading)).toEqual([
      "Music and film",
      "Food and drink",
    ]);
    expect(sections[0]!.blocks).toEqual(["Reggaeton is popular.", "El cine."]);
  });

  test("chatter around the JSON and a bare array both read", () => {
    const chatter = parseTopicNotes(
      "Here are the notes:\n" +
        JSON.stringify([{ heading: "Key terms", blocks: ["El ocio means free time."] }]) +
        "\nI hope that helps.",
      TOPIC,
    );
    expect(chatter.length).toBe(1);
    expect(chatter[0]!.heading).toBe("Key terms");

    const thought = parseTopicNotes(
      "<thinking>planning</thinking>" +
        JSON.stringify({ sections: [{ title: "Grammar", content: "The preterite is used for finished actions." }] }),
      TOPIC,
    );
    expect(thought[0]!.heading).toBe("Grammar");
    expect(thought[0]!.blocks[0]).toContain("preterite");
  });

  test("a single section written without the wrapper is kept", () => {
    const sections = parseTopicNotes(
      JSON.stringify({ heading: "Vocabulary", points: ["la canción - song", "la película - film"] }),
      TOPIC,
    );
    expect(sections.length).toBe(1);
    expect(sections[0]!.blocks.length).toBe(2);
  });

  test("prose written as one long string is split at sentence ends, not cut short", () => {
    const paragraph = Array.from(
      { length: 12 },
      (_, index) => `Sentence ${index + 1} carries a real fact about the topic.`,
    ).join(" ");
    const sections = parseTopicNotes(
      JSON.stringify({ sections: [{ heading: "The Trinity", blocks: paragraph }] }),
      TOPIC,
    );

    const blocks = sections[0]!.blocks;
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) expect(block.length).toBeLessThanOrEqual(MAX_BLOCK_CHARS);
    // Nothing is lost and nothing is cut mid-sentence.
    expect(blocks.join(" ")).toBe(paragraph);
    for (const block of blocks) expect(block).toMatch(/[.!?]$/);
  });

  test("a heading-to-prose map and nested content both read", () => {
    const mapped = parseTopicNotes(
      JSON.stringify({
        "Genesis 1": ["God speaks the universe into existence.", "Six days, then rest."],
        "Genesis 2": "The man is formed from dust.",
      }),
      TOPIC,
    );
    expect(mapped.map((section) => section.heading)).toEqual(["Genesis 1", "Genesis 2"]);
    expect(mapped[0]!.blocks.length).toBe(2);

    const nested = parseTopicNotes(
      JSON.stringify({
        sections: [{ heading: "Stewardship", content: { paragraphs: ["Dominion means care, not exploitation."] } }],
      }),
      TOPIC,
    );
    expect(nested[0]!.blocks[0]).toContain("care");
  });

  test("a reply with broken JSON still yields its sections", () => {
    // The shape a real reply took: the fifth section's key lost its closing
    // quote and colon, which makes the whole document unparseable.
    const broken =
      '{"sections":[' +
      '{"heading":"Scriptural foundations","blocks":["Matthew 3:16-17 records the baptism of Jesus, where all three persons are present at once."]},' +
      '{"heading":"Early creedal formulations","blocks":["The Nicene Creed of 325 AD affirms one Lord Jesus Christ, the Son of God."]},' +
      '{"heading":"Trinitarian worship","blocks[\n "The Sign of the Cross names the Father, the Son and the Holy Spirit." ]},' +
      '{"heading":"Baptism in the Trinitarian formula","blocks":["Matthew 28:19 gives the baptismal formula used in Catholic baptism."]}' +
      ']}';
    const sections = parseTopicNotes(broken, TOPIC);

    expect(sections.length).toBe(4);
    expect(sections.map((section) => section.heading)).toContain(
      "Baptism in the Trinitarian formula",
    );
    expect(sections.flatMap((section) => section.blocks).join(" ")).toContain(
      "Nicene Creed",
    );
    // The junk key is not mistaken for a note.
    for (const block of sections.flatMap((section) => section.blocks)) {
      expect(block).not.toMatch(/^blocks/i);
    }
  });

  test("a reply whose headings lost their quotes is still split per section", () => {
    // The shape a real reply took: `"heading "Free-time activities"` — the
    // opening brace and the quote of the heading value both went missing.
    const reply =
      '{"sections":[' +
      '{"heading":"Music genres","blocks":["Reggaeton and flamenco are both popular in Spain."]},' +
      ' "heading "Free-time activities and hobbies", "Discuss leisure activities: leer, ver peliculas, nadar."},' +
      ' "heading "Film and TV", "Talk about cine, television and series with opinion phrases."]}';
    const sections = parseTopicNotes(reply, TOPIC);

    expect(sections.map((section) => section.heading)).toEqual([
      "Music genres",
      "Free-time activities and hobbies",
      "Film and TV",
    ]);
    expect(sections[1]!.blocks[0]).toContain("leer, ver peliculas");
    for (const section of sections) {
      expect(section.blocks.join(" ")).not.toMatch(/heading|"blocks"/i);
    }
  });

  test("an unusable response falls back to the topic's own content, never empty", () => {
    for (const raw of ["", "I cannot help with that.", '{"sections":[]}', "{}"]) {
      const sections = parseTopicNotes(raw, TOPIC);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections.flatMap((section) => section.blocks).length).toBeGreaterThan(0);
    }
  });

  test("every topic has notes even with no summary or key points", () => {
    const sections = notesFromTopic({ title: "Origins of the universe", summary: "", keyPoints: [] });
    expect(sections.length).toBe(1);
    expect(sections[0]!.heading).toBe("Origins of the universe");
  });

  test("notes are bounded: long blocks are cut and sections are capped", () => {
    const sections = cleanSections(
      Array.from({ length: MAX_NOTE_SECTIONS + 5 }, (_, index) => ({
        heading: `Section ${index}`,
        blocks: ["x".repeat(MAX_BLOCK_CHARS + 500)],
      })),
    );
    expect(sections.length).toBe(MAX_NOTE_SECTIONS);
    expect(sections[0]!.blocks[0]!.length).toBe(MAX_BLOCK_CHARS);
  });

  test("reading the same response twice gives the same notes", () => {
    const raw = JSON.stringify({
      sections: [{ heading: "Festivals", blocks: ["La Tomatina is held in Buñol."] }],
    });
    expect(parseTopicNotes(raw, TOPIC)).toEqual(parseTopicNotes(raw, TOPIC));
  });
});
