import { describe, expect, it } from "bun:test";
import { isExamTechniqueItem } from "../src/convex/lib/studySetQuality";
import {
  isExamTechniqueTitle,
  splitPathwaySkills,
} from "../src/convex/lib/pathwaySkills";
import {
  pathwayPartOptions,
  pathwayTopicOptions,
} from "../src/lib/pathwaySections";

type Topic = {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  examSkill?: string;
};

const topic = (id: string, title: string, examSkill = "Write about methods."): Topic => ({
  id,
  title,
  summary: `${title} summary`,
  keyPoints: [`${title} point`],
  examSkill,
});

/** A Literature pathway shaped like the scraped one that caused the report. */
const literaturePathway = () => ({
  overview: "A GCSE English Literature pathway.",
  examFormat: "Check the AQA specification.",
  version: 5,
  units: [
    {
      title: "Shakespeare",
      summary: "Macbeth and how to write about it.",
      topics: [
        topic("u1t1", "How to Answer the Shakespeare Essay Question"),
        topic("u1t2", "Macbeth: ambition and guilt"),
      ],
    },
    {
      title: "Exam skills",
      summary: "Technique for the whole paper.",
      topics: [
        topic("u2t1", "Exam technique: timing the paper"),
        topic("u2t2", "Mark scheme analysis"),
      ],
    },
    {
      title: "19th-century novel",
      summary: "A Christmas Carol.",
      topics: [topic("u3t1", "A Christmas Carol: redemption")],
    },
  ],
});

describe("isExamTechniqueTitle", () => {
  it("recognises the guide pages notes sites publish beside the content", () => {
    for (const title of [
      "How to Answer the Shakespeare Essay Question",
      "Exam technique",
      "Exam skills",
      "Command words",
      "Assessment objectives",
      "Mark scheme analysis",
      "Paper structure",
      "Question types",
      "Writing frame for Paper 2",
      "Model answers",
      "Examiner tips",
      "Common mistakes",
      "Overview",
    ]) {
      expect(isExamTechniqueTitle(title)).toBe(true);
    }
  });

  it("leaves subject content alone, including overviews of a text", () => {
    for (const title of [
      "Macbeth: ambition and guilt",
      "Romeo & Juliet: Overview",
      "Cells and microscopy",
      "A Christmas Carol: redemption",
      "Poetry anthology: Power and Conflict",
      "The theme of ambition in Macbeth",
    ]) {
      expect(isExamTechniqueTitle(title)).toBe(false);
    }
  });
});

describe("splitPathwaySkills", () => {
  it("moves guides out of the topics and beside their part", () => {
    const split = splitPathwaySkills(literaturePathway());

    expect(split.units).toHaveLength(2);
    expect(split.units[0]!.topics.map((entry) => entry.id)).toEqual(["u1t2"]);
    expect(split.units[0]!.skills?.map((skill) => skill.title)).toEqual([
      "How to Answer the Shakespeare Essay Question",
      // The technique-only part above it is folded in, so no guide is lost and
      // no empty part is left on the pathway.
      "Exam technique: timing the paper",
      "Mark scheme analysis",
    ]);
    expect(split.units[1]!.topics.map((entry) => entry.id)).toEqual(["u3t1"]);

    for (const unit of split.units) {
      expect(unit.topics.length).toBeGreaterThan(0);
      for (const entry of unit.topics) {
        expect(isExamTechniqueTitle(entry.title)).toBe(false);
      }
    }
  });

  it("is stable when applied twice, as every builder does", () => {
    const once = splitPathwaySkills(literaturePathway());
    const twice = splitPathwaySkills(once);
    expect(twice).toEqual(once);
  });

  it("does not invent a skills list for a pathway with no guides", () => {
    const split = splitPathwaySkills({
      units: [
        {
          title: "Cells",
          summary: "Cell structure.",
          topics: [topic("u1t1", "Cell structure"), topic("u1t2", "Cell division")],
        },
      ],
    });
    expect(split.units).toHaveLength(1);
    expect("skills" in split.units[0]!).toBe(false);
  });

  it("keeps a content topic that only mentions technique in its exam skill", () => {
    const split = splitPathwaySkills({
      units: [
        {
          title: "Poetry",
          summary: "Power and Conflict.",
          topics: [
            topic("u1t1", "Comparing poems", "Compare the writers' methods, not just subject matter."),
          ],
        },
      ],
    });
    expect(split.units[0]!.topics).toHaveLength(1);
    expect(split.units[0]!.skills).toBeUndefined();
  });
});

describe("the set builder after the split", () => {
  it("offers only content topics, so a part tick can never select a guide", () => {
    const split = splitPathwaySkills(literaturePathway());
    const parts = pathwayPartOptions(split.units);
    const topics = pathwayTopicOptions(split.units);

    expect(parts.map((part) => part.title)).toEqual(["Shakespeare", "19th-century novel"]);
    expect(parts.flatMap((part) => part.topicIds)).toEqual(["u1t2", "u3t1"]);
    expect(topics.map((entry) => entry.title)).toEqual([
      "Macbeth: ambition and guilt",
      "A Christmas Carol: redemption",
    ]);
  });
});

describe("isExamTechniqueItem", () => {
  it("rejects the essay-structure questions the report was about", () => {
    expect(
      isExamTechniqueItem(
        "What is the function of the 'writer's methods' section in a 19th-century novel essay?",
        "It gives you marks for methods.",
      ),
    ).toBe(true);
    expect(
      isExamTechniqueItem("How should you structure a 30-mark essay?", ""),
    ).toBe(true);
    expect(isExamTechniqueItem("How many paragraphs should a Paper 2 answer have?"))
      .toBe(true);
    expect(isExamTechniqueItem("What do examiners look for in a grade 9 answer?"))
      .toBe(true);
  });

  it("keeps real subject questions, including ones about writing", () => {
    expect(
      isExamTechniqueItem(
        "How does Shakespeare present ambition in Macbeth?",
        "Through Macbeth's soliloquies and the imagery of darkness.",
      ),
    ).toBe(false);
    expect(isExamTechniqueItem("What is the role of the cell membrane?")).toBe(false);
    expect(
      isExamTechniqueItem("Why does the writer use a simile to describe the fog?"),
    ).toBe(false);
  });
});
