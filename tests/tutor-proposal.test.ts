import { describe, expect, test } from "bun:test";
import {
  isBuildConfirmation,
  proposedBuildLines,
  resolveProposedBuilds,
  type TutorAgentCourse,
} from "../src/convex/lib/tutorAgent";

const spanish: TutorAgentCourse = {
  id: "spanish",
  subject: "Spanish",
  level: "GCSE",
  examBoard: "AQA",
  units: [
    {
      title: "Theme 1: Identity and culture",
      topics: [
        { id: "family", title: "Family and relationships" },
        { id: "technology", title: "Technology in everyday life" },
      ],
    },
  ],
};

const chemistry: TutorAgentCourse = {
  id: "chemistry",
  subject: "Chemistry",
  level: "GCSE",
  examBoard: "AQA",
  units: [
    {
      title: "Atomic structure and the periodic table",
      topics: [
        { id: "atoms", title: "Atomic structure" },
        { id: "periodic", title: "The periodic table" },
      ],
    },
  ],
};

const physics: TutorAgentCourse = {
  id: "physics",
  subject: "Physics",
  level: "GCSE",
  examBoard: "AQA",
  units: [
    {
      title: "Waves",
      topics: [{ id: "wave-properties", title: "Wave properties" }],
    },
  ],
};

const courses = [spanish, chemistry, physics];

/** The reply shape from the reported conversation. */
const PROPOSAL = [
  "Here are the 3 sets, one for each of your courses, covering the mentioned topics:",
  "",
  "1. GCSE Spanish - Identity and Culture",
  "2. GCSE Chemistry - Atomic Structure and the Periodic Table",
  "3. GCSE Physics - (No specific topics mentioned, but I can create a set on a general topic like Energy or Motion)",
  "",
  "Let me know if you would like me to proceed with creating these sets or if you need further clarification on any of the topics.",
].join("\n");

describe("agreeing to the tutor's offer", () => {
  test("recognises the sentence that failed to build anything", () => {
    expect(isBuildConfirmation("Ok, then, proceed to set generation")).toBe(true);
    expect(isBuildConfirmation("yes, please proceed")).toBe(true);
    expect(isBuildConfirmation("go ahead")).toBe(true);
    expect(isBuildConfirmation("Ok")).toBe(true);
    expect(isBuildConfirmation("create those sets")).toBe(true);
  });

  test("does not treat a new build request or a question as agreement", () => {
    expect(isBuildConfirmation("Build me a Spanish quiz on topic 1")).toBe(false);
    expect(isBuildConfirmation("Are you sure those are all the topics?")).toBe(false);
    expect(isBuildConfirmation("Make a study set for unit 2")).toBe(false);
  });
});

describe("reading the sets a reply offered", () => {
  test("reads one course and topic per numbered line", () => {
    const lines = proposedBuildLines(PROPOSAL);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({
      course: "GCSE Spanish",
      topic: "Identity and Culture",
    });
    expect(lines[1]?.course).toBe("GCSE Chemistry");
  });

  test("does not read a numbered list of questions as courses", () => {
    expect(
      proposedBuildLines("1. What is mitosis?\n2. What is diffusion?"),
    ).toEqual([]);
  });
});

describe("resolving an offer into real builds", () => {
  test("builds every set that matches a course, and reports the rest", () => {
    const { plans, unresolved } = resolveProposedBuilds(PROPOSAL, courses);

    expect(plans.map((entry) => entry.courseId).sort()).toEqual([
      "chemistry",
      "spanish",
    ]);
    // A theme or unit name stands for the topics inside it.
    expect(plans.find((entry) => entry.courseId === "spanish")?.topicIds).toEqual([
      "family",
      "technology",
    ]);
    expect(
      plans.find((entry) => entry.courseId === "chemistry")?.topicIds,
    ).toEqual(["atoms", "periodic"]);

    // Physics named no topic in the student's pathway, so it is not guessed.
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toContain("Physics");
  });

  test("builds agreed sets at the account maximum when the reply names no size", () => {
    const { plans } = resolveProposedBuilds(PROPOSAL, courses);
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(plan.counts).toEqual({ cards: 100, quiz: 100, exam: 100 });
    }
  });

  test("an offer that mentions no sets is not an offer", () => {
    const numbered = "1. GCSE Spanish - Identity and Culture";
    expect(resolveProposedBuilds(numbered, courses).plans).toEqual([]);
  });

  test("refuses to pick between two courses of the same subject", () => {
    const aLevel: TutorAgentCourse = {
      ...spanish,
      id: "spanish-alevel",
      level: "A-Level",
      units: [
        {
          title: "Theme 1: Identity and culture",
          topics: [{ id: "family-alevel", title: "Family and relationships" }],
        },
      ],
    };
    const ambiguous = resolveProposedBuilds(
      "Here are the sets:\n\n1. Spanish - Identity and Culture",
      [spanish, aLevel],
    );
    expect(ambiguous.plans).toEqual([]);
    expect(ambiguous.unresolved).toHaveLength(1);

    // The level label settles it.
    const labelled = resolveProposedBuilds(
      "Here are the sets:\n\n1. A-Level Spanish - Identity and Culture",
      [spanish, aLevel],
    );
    expect(labelled.plans.map((entry) => entry.courseId)).toEqual([
      "spanish-alevel",
    ]);
  });
});
