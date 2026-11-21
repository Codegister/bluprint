import { describe, expect, test } from "bun:test";

import {
  literaturePaperSplit,
  topicsInPaper,
} from "../src/convex/lib/paperScope";

/**
 * The reported failure: a timetable set to "Paper 1" for English Literature
 * scheduled Modern texts and the poetry anthology, which belong to Paper 2.
 */
const englishLit = [
  { topicId: "shakespeare", topic: "Macbeth" },
  { topicId: "novel", topic: "A Christmas Carol" },
  { topicId: "modern", topic: "An Inspector Calls" },
  { topicId: "poetry", topic: "Power and Conflict" },
];

const split = [
  {
    label: "Paper 1: Shakespeare and the 19th-century novel",
    topicIds: ["shakespeare", "novel"],
  },
  {
    label: "Paper 2: Modern texts and poetry",
    topicIds: ["modern", "poetry"],
  },
];

describe("topics for the chosen paper", () => {
  test("Paper 1 keeps only Paper 1 topics", () => {
    expect(
      topicsInPaper(englishLit, split, "Paper 1").map((topic) => topic.topicId),
    ).toEqual(["shakespeare", "novel"]);
  });

  test("Paper 2 keeps only Paper 2 topics", () => {
    expect(
      topicsInPaper(englishLit, split, "Paper 2").map((topic) => topic.topicId),
    ).toEqual(["modern", "poetry"]);
  });

  test("Both keeps the whole pathway", () => {
    expect(topicsInPaper(englishLit, split, "Both")).toEqual(englishLit);
  });

  test("a course with no recorded split keeps its whole pathway", () => {
    expect(topicsInPaper(englishLit, undefined, "Paper 1")).toEqual(englishLit);
    expect(topicsInPaper(englishLit, [], "Paper 1")).toEqual(englishLit);
  });

  test("a split with no matching label keeps the whole pathway", () => {
    expect(
      topicsInPaper(englishLit, [{ label: "Component 1", topicIds: ["modern"] }], "Paper 1"),
    ).toEqual(englishLit);
  });

  test("a split whose topic ids no longer exist keeps the pathway rather than emptying it", () => {
    expect(
      topicsInPaper(
        englishLit,
        [{ label: "Paper 1", topicIds: ["old-shakespeare"] }],
        "Paper 1",
      ),
    ).toEqual(englishLit);
  });

  test("reads the labels the course pathways actually store", () => {
    const labels = [
      "Paper 1",
      "paper 2",
      "Paper one",
      "Paper 1: Shakespeare and the 19th-century novel",
    ];
    for (const label of labels) {
      const narrowed = topicsInPaper(
        englishLit,
        [
          { label, topicIds: label.toLowerCase().includes("2") ? ["modern"] : ["novel"] },
        ],
        label,
      );
      expect(narrowed).toHaveLength(1);
    }
  });

  test("a label naming both papers is not treated as one of them", () => {
    const bothLabel = [
      { label: "Papers 1 and 2", topicIds: ["modern"] },
    ];
    expect(topicsInPaper(englishLit, bothLabel, "Papers 1 and 2")).toEqual(
      englishLit,
    );
  });

  test("keeps the pathway's original order", () => {
    expect(
      topicsInPaper(
        englishLit,
        [{ label: "Paper 1", topicIds: ["poetry", "shakespeare"] }],
        "Paper 1",
      ).map((topic) => topic.topicId),
    ).toEqual(["shakespeare", "poetry"]);
  });

  describe("English Literature pathways without a stored paper split", () => {
    const units = [
      { title: "Shakespeare", topics: [{ id: "shakespeare" }] },
      { title: "The 19th-century novel", topics: [{ id: "novel" }] },
      { title: "Modern texts", topics: [{ id: "modern" }] },
      { title: "Poetry anthology: Power and Conflict", topics: [{ id: "poetry" }] },
      { title: "Exam skills", topics: [{ id: "skills" }] },
    ];
    const course = { subject: "English Literature", level: "GCSE", examBoard: "AQA" };
    const topics = units.flatMap((unit) =>
      unit.topics.map((topic) => ({ topicId: topic.id })),
    );
    const idsFor = (paper: string) =>
      topicsInPaper(topics, literaturePaperSplit(course, units), paper).map(
        (topic) => topic.topicId,
      );

    test("AQA Paper 1 is Shakespeare and the novel, not the modern text or poetry", () => {
      expect(idsFor("Paper 1")).toEqual(["shakespeare", "novel", "skills"]);
    });

    test("AQA Paper 2 is the modern text and poetry", () => {
      expect(idsFor("Paper 2")).toEqual(["modern", "poetry", "skills"]);
    });

    test("Each board keeps its own split", () => {
      const split = (examBoard: string) =>
        literaturePaperSplit({ ...course, examBoard }, units);
      const ids = (examBoard: string, paper: string) =>
        topicsInPaper(topics, split(examBoard), paper).map(
          (topic) => topic.topicId,
        );

      expect(ids("Pearson Edexcel", "Paper 1")).toEqual([
        "shakespeare",
        "modern",
        "skills",
      ]);
      expect(ids("Pearson Edexcel", "Paper 2")).toEqual([
        "novel",
        "poetry",
        "skills",
      ]);
      expect(ids("OCR", "Paper 1")).toEqual(["novel", "modern", "skills"]);
      expect(ids("OCR", "Paper 2")).toEqual([
        "shakespeare",
        "poetry",
        "skills",
      ]);
      expect(ids("Eduqas", "Paper 1")).toEqual([
        "shakespeare",
        "poetry",
        "skills",
      ]);
      expect(ids("Eduqas", "Paper 2")).toEqual(["novel", "modern", "skills"]);
    });

    test("A board or level with no fixed split keeps the whole pathway", () => {
      expect(
        literaturePaperSplit({ ...course, examBoard: "WJEC" }, units),
      ).toBeUndefined();
      expect(
        literaturePaperSplit({ ...course, level: "A-level" }, units),
      ).toBeUndefined();
      expect(topicsInPaper(topics, undefined, "Paper 1")).toEqual(topics);
    });

    test("a pathway with no recognised text units keeps the whole pathway", () => {
      expect(
        literaturePaperSplit(course, [
          { title: "Course content", topics: [{ id: "poetry" }] },
        ]),
      ).toBeUndefined();
    });
  });
});
