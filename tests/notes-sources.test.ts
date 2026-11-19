import { describe, expect, it } from "bun:test";
import {
  cognitoNotesPagesForTopic,
  cognitoNotesUrlMatches,
  groupCognitoTopicLinks,
  parseCognitoTopicLinks,
  type CognitoOutline,
  type CognitoTopicPageLink,
} from "../src/convex/lib/cognito";
import { mergeNoteSections, mergeNotesReads } from "../src/convex/lib/notesMerge";
import {
  findSaveMyExamsNotesPages,
  notesIndexBelongsToCourse,
  type SaveMyExamsNotePage,
  type SaveMyExamsNotesIndex,
} from "../src/convex/lib/savemyexams";

const SITE = "https://www.savemyexams.com";

function page(
  sectionTitle: string,
  topicTitle: string,
  title: string,
  slug: string,
  base = "/gcse/religious-studies/edexcel/b/16/revision-notes/",
): SaveMyExamsNotePage {
  return {
    title,
    topicTitle,
    sectionTitle,
    url: `${SITE}${base}${slug}/`,
    indexBasePath: base,
  };
}

const rsIndex: SaveMyExamsNotesIndex = {
  basePath: "/gcse/religious-studies/edexcel/b/16/revision-notes/",
  pages: [
    page(
      "Christianity: Religion & Ethics",
      "Christian Beliefs: The Trinity & Creation",
      "Nature & Significance of the Trinity",
      "christianity/trinity/nature",
    ),
    page(
      "Christianity: Religion & Ethics",
      "Christian Beliefs: The Trinity & Creation",
      "Christian Beliefs About Creation",
      "christianity/trinity/creation",
    ),
    page(
      "Christianity: Religion & Ethics",
      "Christian Practices: Worship & Celebrations",
      "The Mass",
      "christianity/worship/mass",
    ),
    page(
      "Islam: Religion & Ethics",
      "Muslim Beliefs: Allah & the Prophets",
      "The Nature of Allah",
      "islam/allah/nature",
    ),
    page(
      "Islam: Religion & Ethics",
      "Islam: Pilgrimage & Festivals",
      "Hajj",
      "islam/pilgrimage/hajj",
    ),
    page(
      "Islam: Peace & Conflict",
      "Islam: Crime & Punishment",
      "Crime and Punishment",
      "islam/crime/punishment",
    ),
    page(
      "Christianity: Peace & Conflict",
      "Christianity: Crime & Punishment",
      "Crime and Punishment",
      "christianity/crime/punishment",
    ),
    page(
      "Judaism: Peace & Conflict",
      "Judaism: Crime & Punishment",
      "Crime and Punishment",
      "judaism/crime/punishment",
    ),
  ],
};

describe("Save My Exams contextual topic matching", () => {
  it("keeps a named religion's concept inside that religion", () => {
    const pages = findSaveMyExamsNotesPages(
      [rsIndex],
      { title: "The Trinity" },
      { unitTitle: "Beliefs and practices — Christianity" },
    );
    expect(pages.map((entry) => entry.title)).toEqual([
      "Nature & Significance of the Trinity",
      "Christian Beliefs About Creation",
    ]);
  });

  it("does not borrow another religion's topic on a partial name", () => {
    expect(
      findSaveMyExamsNotesPages(
        [rsIndex],
        { title: "Pilgrimage and festivals" },
        { unitTitle: "Beliefs and practices — Christianity" },
      ),
    ).toEqual([]);
  });

  it("merges the same concept across religions in a generic part", () => {
    const pages = findSaveMyExamsNotesPages(
      [rsIndex],
      { title: "Crime and punishment" },
      { unitTitle: "Religion, Peace and Conflict" },
    );
    expect(pages.map((entry) => entry.sectionTitle).sort()).toEqual([
      "Christianity: Peace & Conflict",
      "Islam: Peace & Conflict",
      "Judaism: Peace & Conflict",
    ]);
  });

  it("matches a poetry cluster even though the site adds 'Anthology'", () => {
    const literature: SaveMyExamsNotesIndex = {
      basePath: "/gcse/english-literature/aqa/17/revision-notes/",
      pages: [
        page(
          "4. The Poetry Anthology",
          "Power & Conflict Anthology",
          "Ozymandias",
          "poetry/power-conflict/ozymandias",
          "/gcse/english-literature/aqa/17/revision-notes/",
        ),
      ],
    };
    const pages = findSaveMyExamsNotesPages(
      [literature],
      { title: "Power & Conflict" },
      { unitTitle: "4. The Poetry Anthology" },
    );
    expect(pages.map((entry) => entry.title)).toEqual(["Ozymandias"]);
  });

  it("rejects an index that sits above the matched course", () => {
    expect(
      notesIndexBelongsToCourse(
        "/gcse/biology/aqa/18/revision-notes/",
        "/gcse/biology/aqa/18/",
      ),
    ).toBe(true);
    expect(
      notesIndexBelongsToCourse(
        "/gcse/biology/aqa/revision-notes/",
        "/gcse/biology/aqa/18/",
      ),
    ).toBe(false);
  });

  it("leaves an unmatched topic empty rather than guessing", () => {
    expect(
      findSaveMyExamsNotesPages(
        [rsIndex],
        { title: "The Mass" },
        { unitTitle: "Beliefs and practices — Islam" },
      ),
    ).toEqual([]);
  });
});

describe("Cognito notes mapping", () => {
  const link = (reference: string, title: string, slug: string): CognitoTopicPageLink => ({
    reference,
    title,
    url: `https://cognito.org/courses/gcse/english-literature/aqa/notes/${slug}/${reference}-${slug}/`,
  });

  // Literature restarts numbering for every set text, so both texts have 1.1.
  const links = [
    link("1.1", "The Author In Context", "macbeth"),
    link("1.2", "Plot Overview", "macbeth"),
    link("2.1", "Key Characters", "macbeth"),
    link("1.1", "The Author In Context", "romeo"),
    link("1.2", "Plot Overview", "romeo"),
  ];
  const outline: CognitoOutline = {
    sourceUrl: "https://cognito.org/courses/gcse/english-literature/aqa/notes",
    label: "GCSE English Literature (AQA)",
    sections: [
      {
        title: "Macbeth",
        topics: [
          {
            title: "Introduction and Foundations",
            reference: "1",
            subtopics: [
              { reference: "1.1", title: "The Author in Context" },
              { reference: "1.2", title: "Plot Overview" },
            ],
          },
          {
            title: "Characters",
            reference: "2",
            subtopics: [{ reference: "2.1", title: "Key Characters" }],
          },
        ],
      },
      {
        title: "Romeo & Juliet",
        topics: [
          {
            title: "Introduction and Foundations",
            reference: "1",
            subtopics: [
              { reference: "1.1", title: "The Author in Context" },
              { reference: "1.2", title: "Plot Overview" },
            ],
          },
        ],
      },
    ],
  };

  it("assigns a flat index to the outline's own sections", () => {
    const groups = groupCognitoTopicLinks(links, outline);
    expect(groups?.map((group) => [group.section, group.links.length])).toEqual([
      ["Macbeth", 3],
      ["Romeo & Juliet", 2],
    ]);
    expect(groups?.[0]?.links.map((entry) => entry.reference)).toEqual([
      "1.1",
      "1.2",
      "2.1",
    ]);
  });

  it("refuses to group when the counts do not line up", () => {
    expect(groupCognitoTopicLinks(links.slice(0, 4), outline)).toBeNull();
    // Dropping Macbeth 2.1 shifts the next text's 1.1 into its place, which
    // must fail rather than being read as Macbeth's characters.
    expect(
      groupCognitoTopicLinks([links[0]!, links[1]!, links[3]!, links[4]!], outline),
    ).toBeNull();
  });

  it("reads a topic's numbered subtopics inside its own text", () => {
    const groups = groupCognitoTopicLinks(links, outline)!;
    const pages = cognitoNotesPagesForTopic(
      groups,
      links,
      { title: "Introduction and Foundations", reference: "1" },
      "Macbeth",
    );
    expect(pages.map((entry) => entry.title)).toEqual([
      "The Author In Context",
      "Plot Overview",
    ]);
    // The same number in Romeo & Juliet is a different page and is not read.
    expect(pages.every((entry) => entry.url.includes("macbeth"))).toBe(true);
  });

  it("takes the whole text when the topic names it", () => {
    const groups = groupCognitoTopicLinks(links, outline)!;
    const pages = cognitoNotesPagesForTopic(groups, links, { title: "Macbeth" }, "1. Shakespeare");
    expect(pages).toHaveLength(3);
  });

  it("accepts the course's own notes URL and rejects a general one", () => {
    expect(
      cognitoNotesUrlMatches(
        "https://cognito.org/courses/gcse/biology-triple/aqa/higher/notes",
        "gcse",
        "biology",
        "aqa",
      ),
    ).toBe(true);
    expect(
      cognitoNotesUrlMatches(
        "https://cognito.org/courses/gcse/biology/aqa/notes",
        "gcse",
        "biology",
        "aqa",
      ),
    ).toBe(true);
    expect(
      cognitoNotesUrlMatches(
        "https://cognito.org/courses/gcse/english-literature/notes",
        "gcse",
        "english-literature",
        "aqa",
      ),
    ).toBe(false);
    expect(
      cognitoNotesUrlMatches(
        "https://cognito.org/courses/gcse/religious-studies/edexcel/notes",
        "gcse",
        "religious-studies",
        "aqa",
      ),
    ).toBe(false);
  });

  it("keeps only leaf links from the index that was read", () => {
    const html = [
      '<a href="/courses/gcse/english-literature/aqa/notes/abc/1.1-macbeth">Macbeth</a>',
      '<a href="/courses/gcse/biology/aqa/notes/def/1.1-cells">Cells</a>',
    ].join("");
    const base = "/courses/gcse/english-literature/aqa/notes";
    expect(parseCognitoTopicLinks(html, base).map((entry) => entry.title)).toEqual([
      "Macbeth",
    ]);
    expect(parseCognitoTopicLinks(html)).toHaveLength(2);
  });
});

describe("merging the two sources", () => {
  it("leads with the primary and fills the rest from the secondary", () => {
    const merged = mergeNoteSections(
      [
        { heading: "Cells", blocks: ["a"] },
        { heading: "Microscopy", blocks: ["b"] },
      ],
      [
        { heading: "Cells", blocks: ["a"] },
        { heading: "Mitosis", blocks: ["c"] },
        { heading: "Osmosis", blocks: ["d"] },
      ],
      { primaryLimit: 1, totalLimit: 3 },
    );
    // Only the primary's first card is kept; the secondary then fills the
    // remaining slots (a duplicate heading is skipped).
    expect(merged.map((section) => section.heading)).toEqual([
      "Cells",
      "Mitosis",
      "Osmosis",
    ]);
  });

  it("merges citations once per page and marks a combined read", () => {
    const read = mergeNotesReads(
      {
        sections: [{ heading: "Cells", blocks: ["a"] }],
        sources: [{ title: "Cells", url: "https://www.savemyexams.com/cells/" }],
        failed: false,
      },
      {
        sections: [{ heading: "Mitosis", blocks: ["b"] }],
        sources: [
          { title: "Cells", url: "https://www.savemyexams.com/cells/" },
          { title: "Mitosis", url: "https://cognito.org/mitosis" },
        ],
        failed: false,
      },
    );
    expect(read.sections.map((section) => section.heading)).toEqual([
      "Cells",
      "Mitosis",
    ]);
    expect(read.sources.map((source) => source.url)).toEqual([
      "https://www.savemyexams.com/cells/",
      "https://cognito.org/mitosis",
    ]);
    expect(read.failed).toBe(false);
  });

  it("reports a failure only when both sources failed", () => {
    const failed = { sections: [], sources: [], failed: true };
    expect(mergeNotesReads(failed, { sections: [], sources: [], failed: false }).failed)
      .toBe(false);
    expect(mergeNotesReads(failed, failed).failed).toBe(true);
  });
});
