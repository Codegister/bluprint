import { describe, expect, it } from "bun:test";
import {
  buildPathwayFromOutline,
  pathwaySourcePlan,
} from "../src/convex/ai";
import { samePathway } from "../src/convex/lib/pathwayIdentity";

const course = {
  level: "GCSE",
  subject: "Biology",
  examBoard: "AQA",
  tier: "Higher",
};

const outline = {
  label: "GCSE Biology (AQA)",
  sections: [
    {
      title: "Cell biology",
      topics: [
        {
          title: "Cell structure",
          reference: "1.1",
          subtopics: ["Eukaryotes", "Prokaryotes"],
        },
        { title: "Cell division", reference: "1.2", subtopics: ["Mitosis"] },
      ],
    },
    {
      title: "Exam skills",
      topics: [
        {
          title: "How to Answer the Essay Question",
          reference: "9.1",
          subtopics: [],
        },
        { title: "Mark scheme analysis", reference: "9.2", subtopics: [] },
      ],
    },
  ],
};

describe("pathway generation is reproducible", () => {
  it("builds the same map, ids and copy from the same outline", () => {
    const first = buildPathwayFromOutline(course, outline);
    const second = buildPathwayFromOutline(course, outline);

    expect(second).toEqual(first);
    expect(second.units.map((unit) => unit.topics.map((topic) => topic.id)))
      .toEqual([["u1t1", "u1t2"]]);
    expect(second.overview).toContain("1 unit and 2 topics");
  });

  it("sees the same map when only the field order differs", () => {
    const stored = {
      overview: "x",
      units: [{ title: "U", summary: "s", topics: [{ id: "t", title: "T" }] }],
    };
    const fresh = {
      units: [
        {
          topics: [{ title: "T", id: "t" }],
          summary: "s",
          title: "U",
        },
      ],
      overview: "x",
    };
    expect(samePathway(stored, fresh)).toBe(true);
    expect(samePathway(stored, { ...fresh, overview: "y" })).toBe(false);
  });

  it("does not mutate the outline or its own second run", () => {
    const snapshot = JSON.parse(JSON.stringify(outline));
    buildPathwayFromOutline(course, outline);
    expect(outline).toEqual(snapshot);
  });
});

describe("a rebuild keeps its source", () => {
  it("re-reads only the source the course was built from", () => {
    expect(pathwaySourcePlan("savemyexams")).toEqual(["savemyexams"]);
    expect(pathwaySourcePlan("cognito")).toEqual(["cognito"]);
  });

  it("retries both published sites before a starter map", () => {
    expect(pathwaySourcePlan(undefined)).toEqual([
      "savemyexams",
      "cognito",
      "starter",
    ]);
    expect(pathwaySourcePlan("bluprint")).toEqual([
      "savemyexams",
      "cognito",
      "starter",
    ]);
  });
});
