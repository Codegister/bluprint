import { describe, expect, test } from "bun:test";

import {
  findSaveMyExamsNotesPages,
  parseSaveMyExamsCourse,
  parseSaveMyExamsNotePage,
  parseSaveMyExamsNotesIndex,
  parseSaveMyExamsPastPapers,
} from "../src/convex/lib/savemyexams";

function pageHtml(props: unknown): string {
  return `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    { props: { pageProps: props } },
  )}</script></body></html>`;
}

const biologyCourse = pageHtml({
  breadcrumbs: {
    titles: { level: "GCSE", subject: "Biology", board: "AQA" },
    slugs: { level: "gcse", subject: "biology", board: "aqa", year: "18" },
  },
  courseTitle: "AQA GCSE Biology",
  availableResources: {
    "past-papers": "/gcse/biology/aqa/past-papers/",
  },
});
const biologyCourseWithLinks =
  biologyCourse +
  '<a href="/gcse/biology/aqa/18/revision-notes/">Revision notes</a>' +
  '<a href="/gcse/biology/aqa/18/revision-notes/">Duplicate</a>';

const mathsCourse =
  pageHtml({
    breadcrumbs: {
      titles: { level: "GCSE", subject: "Maths", board: "AQA" },
      slugs: { level: "gcse", subject: "maths", board: "aqa", year: "22" },
    },
    courseTitle: "AQA GCSE Maths",
    availableResources: { "past-papers": "/gcse/maths/aqa/past-papers/" },
  }) +
  '<a href="/gcse/maths/aqa/22/higher/revision-notes/">Higher</a>' +
  '<a href="/gcse/maths/aqa/22/foundation/revision-notes/">Foundation</a>';

describe("Save My Exams course matching", () => {
  test("matches a course only when level, subject and board agree", () => {
    const course = parseSaveMyExamsCourse(biologyCourseWithLinks, {
      level: "GCSE",
      subject: "Biology",
      examBoard: "AQA",
      tier: "Higher",
    });
    expect(course?.basePath).toBe("/gcse/biology/aqa/18/");
    expect(course?.subjectSlug).toBe("biology");
    expect(course?.boardSlug).toBe("aqa");
    expect(course?.notesIndexPaths).toEqual([
      "/gcse/biology/aqa/18/revision-notes/",
    ]);
    expect(course?.pastPapersPath).toBe("/gcse/biology/aqa/past-papers/");

    expect(
      parseSaveMyExamsCourse(biologyCourseWithLinks, {
        level: "GCSE",
        subject: "Chemistry",
        examBoard: "AQA",
      }),
    ).toBeNull();
    expect(
      parseSaveMyExamsCourse(biologyCourseWithLinks, {
        level: "A-Level",
        subject: "Biology",
        examBoard: "AQA",
      }),
    ).toBeNull();
    expect(
      parseSaveMyExamsCourse(biologyCourseWithLinks, {
        level: "GCSE",
        subject: "Biology",
        examBoard: "Edexcel",
      }),
    ).toBeNull();
  });

  test("uses the tier's own Maths route", () => {
    const foundation = parseSaveMyExamsCourse(mathsCourse, {
      level: "GCSE",
      subject: "Mathematics",
      examBoard: "AQA",
      tier: "Foundation",
    });
    expect(foundation?.notesIndexPaths).toEqual([
      "/gcse/maths/aqa/22/foundation/revision-notes/",
    ]);

    const higher = parseSaveMyExamsCourse(mathsCourse, {
      level: "GCSE",
      subject: "Mathematics",
      examBoard: "AQA",
      tier: "Higher",
    });
    expect(higher?.notesIndexPaths).toEqual([
      "/gcse/maths/aqa/22/higher/revision-notes/",
    ]);
  });

  test("does not guess between a hub's two courses", () => {
    const hub = pageHtml({
      breadcrumbs: {
        titles: { level: "GCSE", subject: "Biology", board: "OCR" },
        slugs: { level: "gcse", subject: "biology", board: "ocr" },
      },
      courseOrCourses: [
        { attributes: { name: "OCR GCSE Biology A (Gateway)" } },
        { attributes: { name: "OCR GCSE Biology B" } },
      ],
    });
    expect(
      parseSaveMyExamsCourse(hub, {
        level: "GCSE",
        subject: "Biology",
        examBoard: "OCR",
      }),
    ).toBeNull();
  });
});

const notesIndex = pageHtml({
  basePath: "/gcse/biology/aqa/18/revision-notes/",
  sections: [
    {
      id: "sec1",
      attributes: { name: "Cell Biology", slug: "1-cell-biology", order: 0 },
    },
    {
      id: "sec2",
      attributes: { name: "Organisation", slug: "2-organisation", order: 1 },
    },
  ],
  topics: [
    {
      id: "top1",
      attributes: {
        name: "Cell Structure",
        slug: "1-1-cell-structure",
        order: 0,
      },
      relationships: { section: { data: { id: "sec1" } } },
    },
    {
      id: "top2",
      attributes: {
        name: "Cell Division",
        slug: "1-2-cell-division",
        order: 1,
      },
      relationships: { section: { data: { id: "sec1" } } },
    },
  ],
  subtopics: [
    {
      id: "sub1",
      attributes: {
        name: "Eukaryotes & Prokaryotes",
        slug: "1-1-1-eukaryotes--prokaryotes",
        status: "published",
        order: 0,
      },
      relationships: {
        topic: { data: { id: "top1" } },
        revision_note: { data: { id: "rn1" } },
      },
    },
    {
      id: "sub2",
      attributes: {
        name: "Animal & Plant Cells",
        slug: "1-1-2-animal--plant-cells",
        status: "published",
        order: 1,
      },
      relationships: {
        topic: { data: { id: "top1" } },
        revision_note: { data: { id: "rn2" } },
      },
    },
    {
      id: "sub3",
      attributes: {
        name: "Chromosomes",
        slug: "1-2-1-chromosomes",
        status: "published",
        order: 0,
      },
      relationships: {
        topic: { data: { id: "top2" } },
        revision_note: { data: { id: "rn3" } },
      },
    },
  ],
});

describe("Save My Exams notes index", () => {
  const parsed = parseSaveMyExamsNotesIndex(notesIndex);

  test("builds the section, topic and subtopic hierarchy", () => {
    expect(parsed?.basePath).toBe("/gcse/biology/aqa/18/revision-notes/");
    expect(parsed?.pages).toHaveLength(3);
    expect(parsed?.pages[0]).toMatchObject({
      title: "Eukaryotes & Prokaryotes",
      sectionTitle: "Cell Biology",
      topicTitle: "Cell Structure",
      topicReference: "1.1",
      reference: "1.1.1",
    });
    expect(parsed?.pages[0]?.url).toContain(
      "/1-cell-biology/1-1-cell-structure/1-1-1-eukaryotes--prokaryotes/",
    );
  });

  test("selects every subtopic of the exact topic, never a namesake", () => {
    const pages = findSaveMyExamsNotesPages(parsed ? [parsed] : [], {
      title: "Cell Structure",
      reference: "1.1",
    });
    expect(pages.map((page) => page.title)).toEqual([
      "Eukaryotes & Prokaryotes",
      "Animal & Plant Cells",
    ]);

    const byReference = findSaveMyExamsNotesPages(parsed ? [parsed] : [], {
      title: "Cells",
      reference: "1.2",
    });
    expect(byReference.map((page) => page.title)).toEqual(["Chromosomes"]);

    expect(
      findSaveMyExamsNotesPages(parsed ? [parsed] : [], {
        title: "Cell Structure",
      }).map((page) => page.title),
    ).toEqual(["Eukaryotes & Prokaryotes", "Animal & Plant Cells"]);
  });

  test("returns nothing for an unmatched topic", () => {
    expect(
      findSaveMyExamsNotesPages(parsed ? [parsed] : [], {
        title: "Genetics",
        reference: "9.9",
      }),
    ).toEqual([]);
  });
});

describe("Save My Exams note pages", () => {
  const notePage = pageHtml({
    basePath: "/gcse/biology/aqa/18/revision-notes/",
    breadcrumbs: {
      slugs: {
        level: "gcse",
        subject: "biology",
        board: "aqa",
        year: "18",
        subtopic: "1-1-1-eukaryotes--prokaryotes",
      },
      titles: {
        level: "GCSE",
        subject: "Biology",
        board: "AQA",
        subtopic: "Eukaryotes & Prokaryotes",
      },
    },
    subtopic: {
      attributes: { name: "Eukaryotes & Prokaryotes" },
    },
    revisionNote: {
      attributes: {
        content: [
          {
            type: "specPoint",
            attrs: { name: "Cells in biology" },
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "Cells in biology" }],
              },
              {
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [
                  {
                    type: "text",
                    text: "Cells are the basic building blocks of all living organisms.",
                  },
                ],
              },
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "a cell membrane" }],
                      },
                    ],
                  },
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "cytoplasm" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "figure",
                attrs: {
                  caption:
                    "All cells have a number of features in common with each other",
                },
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "Use this image" }],
              },
            ],
          },
          {
            type: "specPoint",
            attrs: { name: "Eukaryotic cells" },
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Plant and animal cells are eukaryotic cells.",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  test("turns spec points into readable note sections", () => {
    const sections = parseSaveMyExamsNotePage(
      notePage,
      "/gcse/biology/aqa/18/revision-notes/",
      "1-1-1-eukaryotes--prokaryotes",
    );
    expect(sections?.map((section) => section.heading)).toEqual([
      "Cells in biology",
      "Eukaryotic cells",
    ]);
    expect(sections?.[0]?.blocks).toContain(
      "Cells are the basic building blocks of all living organisms.",
    );
    expect(sections?.[0]?.blocks).toContain("• a cell membrane");
    expect(sections?.[0]?.blocks).toContain("• cytoplasm");
    expect(sections?.[0]?.blocks).toContain(
      "Figure: All cells have a number of features in common with each other",
    );
    expect(sections?.flatMap((section) => section.blocks)).not.toContain(
      "Use this image",
    );
  });

  test("rejects a note page from another course or subtopic", () => {
    expect(
      parseSaveMyExamsNotePage(
        notePage,
        "/gcse/biology/aqa/18/revision-notes/",
        "1-1-2-animal--plant-cells",
      ),
    ).toBeNull();
    expect(
      parseSaveMyExamsNotePage(
        notePage,
        "/gcse/chemistry/aqa/18/revision-notes/",
      ),
    ).toBeNull();
  });
});

const paperPage = pageHtml({
  breadcrumbs: {
    titles: { level: "GCSE", subject: "Biology", board: "AQA" },
    slugs: {
      level: "gcse",
      subject: "biology",
      board: "aqa",
      section: "past-papers",
    },
  },
  course: {
    attributes: { name: "AQA GCSE Biology" },
    included: [
      {
        id: "catF",
        type: "paper_category",
        attributes: { number: "Paper 1", tier: "Foundation", order: 0 },
      },
      {
        id: "catH",
        type: "paper_category",
        attributes: { number: "Paper 1", tier: "Higher", order: 0 },
      },
      {
        id: "paperF",
        type: "past_paper",
        attributes: {
          status: "published",
          is_specimen_paper: false,
          month: 6,
          year: 2025,
          exam_paper: "https://example.test/2025-foundation-qp.pdf",
          mark_scheme: "https://example.test/2025-foundation-ms.pdf",
          code: "8461/1F",
        },
        relationships: { paper_category: { data: { id: "catF" } } },
      },
      {
        id: "paperH",
        type: "past_paper",
        attributes: {
          status: "published",
          is_specimen_paper: false,
          month: 6,
          year: 2025,
          exam_paper: "https://example.test/2025-higher-qp.pdf",
          mark_scheme: "https://example.test/2025-higher-ms.pdf",
          code: "8461/1H",
        },
        relationships: { paper_category: { data: { id: "catH" } } },
      },
      {
        id: "paperOld",
        type: "past_paper",
        attributes: {
          status: "published",
          is_specimen_paper: false,
          month: 11,
          year: 2024,
          exam_paper: "https://example.test/2024-foundation-qp.pdf",
          mark_scheme: "https://example.test/2024-foundation-ms.pdf",
          code: "8461/1F",
        },
        relationships: { paper_category: { data: { id: "catF" } } },
      },
      {
        id: "paperSpecimen",
        type: "past_paper",
        attributes: {
          status: "published",
          is_specimen_paper: true,
          year: 2024,
          exam_paper: "https://example.test/specimen-qp.pdf",
          mark_scheme: "https://example.test/specimen-ms.pdf",
          code: "8461/1",
        },
        relationships: { paper_category: { data: { id: "catF" } } },
      },
      {
        id: "paperDraft",
        type: "past_paper",
        attributes: {
          status: "draft",
          year: 2026,
          exam_paper: "https://example.test/draft.pdf",
        },
        relationships: { paper_category: { data: { id: "catF" } } },
      },
    ],
  },
});

describe("Save My Exams past papers", () => {
  test("keeps only the course's tier and sorts newest first", () => {
    const papers = parseSaveMyExamsPastPapers(paperPage, {
      tier: "Foundation",
      levelSlug: "gcse",
      subjectSlug: "biology",
      boardSlug: "aqa",
    });
    expect(papers.map((paper) => paper.questionUrl)).toEqual([
      "https://example.test/2025-foundation-qp.pdf",
      "https://example.test/2024-foundation-qp.pdf",
      "https://example.test/specimen-qp.pdf",
    ]);
    expect(papers[0]?.label).toBe(
      "Jun · Paper 1 (Foundation) · 8461/1F",
    );
    expect(papers[0]?.year).toBe("2025");
    expect(papers[1]?.year).toBe("2024");
    expect(papers[2]?.year).toBe("Specimen");
    expect(papers[2]?.label).toContain("Specimen");
    expect(papers[0]?.markSchemeUrl).toBe(
      "https://example.test/2025-foundation-ms.pdf",
    );
    expect(papers.some((paper) => paper.label.includes("Higher"))).toBe(false);
    expect(papers.some((paper) => paper.questionUrl.includes("draft"))).toBe(
      false,
    );
  });

  test("returns both tiers when no tier is requested", () => {
    const papers = parseSaveMyExamsPastPapers(paperPage);
    expect(papers).toHaveLength(4);
    expect(papers.filter((paper) => paper.label.includes("Higher"))).toHaveLength(
      1,
    );
  });

  test("rejects a past-paper page for another board", () => {
    expect(
      parseSaveMyExamsPastPapers(paperPage, {
        levelSlug: "gcse",
        subjectSlug: "biology",
        boardSlug: "edexcel",
      }),
    ).toEqual([]);
  });
});
