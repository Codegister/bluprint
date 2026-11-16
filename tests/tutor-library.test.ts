import { describe, expect, test } from "bun:test";
import {
  LIBRARY_MATERIAL_LIMIT,
  libraryTutorMaterial,
  type TutorLibraryCourse,
} from "../src/convex/lib/tutorLibrary";

const biology: TutorLibraryCourse = {
  subject: "Biology",
  level: "GCSE",
  examBoard: "AQA",
  pathway: {
    overview: "Cells, organisms and their systems.",
    examFormat: "Two written papers.",
    units: [
      {
        title: "Cell biology",
        summary: "The building blocks of living things.",
        topics: [
          {
            title: "Cell division",
            specReference: "4.1.2",
            summary: "Mitosis and the cell cycle.",
            keyPoints: ["Chromosomes replicate before division."],
            examSkill: "Describe the stages in order.",
          },
        ],
      },
    ],
  },
};

const spanish: TutorLibraryCourse = {
  subject: "Spanish",
  level: "GCSE",
  examBoard: "AQA",
  tier: "Higher",
  options: "Theme 1 and Theme 2",
  pathway: {
    overview: "Identity, culture and local areas.",
    examFormat: "Four papers.",
    units: [
      {
        title: "Theme 1: Identity and culture",
        summary: "Family, technology and customs.",
        topics: [
          {
            title: "Family and relationships",
            summary: "Describing people and relationships.",
            keyPoints: ["Use ser and estar accurately."],
          },
        ],
      },
    ],
  },
};

describe("all-course tutor material", () => {
  test("includes every course, not just the first", () => {
    const material = libraryTutorMaterial([biology, spanish]);
    expect(material).toContain("# GCSE Biology (AQA)");
    expect(material).toContain("# GCSE Spanish (AQA)");
    expect(material).toContain("Cell division");
    expect(material).toContain("Family and relationships");
    expect(material).toContain("Chosen options");
  });

  test("keeps a course header even when the material is tight", () => {
    const material = libraryTutorMaterial([biology, spanish], 700);
    expect(material).toContain("GCSE Biology");
    expect(material).toContain("GCSE Spanish");
  });

  test("honours the shared material ceiling", () => {
    const courses = Array.from({ length: 12 }, (_, index) => ({
      ...biology,
      subject: `Subject ${index + 1}`,
    }));
    const material = libraryTutorMaterial(courses);
    expect(material.length).toBeLessThanOrEqual(LIBRARY_MATERIAL_LIMIT);
    for (const course of courses) {
      expect(material).toContain(course.subject);
    }
  });
});
