import { describe, expect, test } from "bun:test";

import {
  aqaBiologyGaps,
  buildAqaBiologyPathway,
  isAqaGcseBiology,
} from "../src/convex/lib/specPathways";

const COURSE = { subject: "Biology", level: "GCSE", examBoard: "AQA" };

describe("AQA GCSE Biology specification pathway", () => {
  test("only the exact course uses the specification map", () => {
    expect(isAqaGcseBiology(COURSE)).toBe(true);
    expect(isAqaGcseBiology({ ...COURSE, examBoard: "Edexcel" })).toBe(false);
    expect(isAqaGcseBiology({ ...COURSE, subject: "Combined Science" })).toBe(false);
  });

  test("keeps AQA numbering and includes active transport", () => {
    const pathway = buildAqaBiologyPathway(COURSE);
    expect(pathway).not.toBeNull();
    const topics = pathway!.units.flatMap((unit) => unit.topics);
    expect(topics.some((topic) => topic.title === "Active transport")).toBe(true);
    expect(topics.find((topic) => topic.title === "Active transport")?.specReference).toBe(
      "4.1.3.3",
    );
    expect(topics.every((topic) => /^4\.\d/.test(topic.specReference ?? ""))).toBe(true);
  });

  test("has seven specification parts, no Exam Skills part and no filler skill line", () => {
    const pathway = buildAqaBiologyPathway(COURSE)!;
    expect(pathway.units).toHaveLength(7);
    expect(pathway.units.some((unit) => /exam skills/i.test(unit.title))).toBe(false);
    expect(
      pathway.units.flatMap((unit) => unit.topics).every((topic) => topic.examSkill === ""),
    ).toBe(true);
    expect(aqaBiologyGaps()).toEqual([]);
  });

  test("states the real paper structure", () => {
    const pathway = buildAqaBiologyPathway(COURSE)!;
    expect(pathway.examFormat).toContain("1 hour 45 minutes");
    expect(pathway.examFormat).toContain("100 marks");
    expect(pathway.examFormat).toContain("50%");
    expect(pathway.papers.map((paper) => paper.label)).toEqual(["Paper 1", "Paper 2"]);
  });
});
