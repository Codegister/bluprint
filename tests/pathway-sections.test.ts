import { describe, expect, test } from "bun:test";

import {
  MAX_COMBINED_TOPICS,
  pathwayPartIdsForTopics,
  pathwayPartOptions,
  pathwaySectionOptions,
  pathwayTopicOptions,
} from "../src/lib/pathwaySections";

const CHEMISTRY = [
  {
    title: "Atomic structure and the periodic table",
    topics: Array.from({ length: 10 }, (_, index) => ({
      id: `chem-${index + 1}`,
      title: `Chemistry topic ${index + 1}`,
    })),
  },
];

describe("course topic picker", () => {
  test("a ten-topic course offers ten topics, not the twelve-topic limit", () => {
    const options = pathwaySectionOptions(CHEMISTRY, "chem-1");
    expect(options).toHaveLength(10);
    expect(options.at(-1)?.title).toBe("Chemistry topic 10");
  });

  test("the available count shrinks from the chosen topic onwards", () => {
    expect(pathwaySectionOptions(CHEMISTRY, "chem-8")).toHaveLength(3);
    expect(pathwaySectionOptions(CHEMISTRY, "chem-10")).toHaveLength(1);
  });

  test("duplicate ids cannot inflate the offered count", () => {
    const units = [
      ...CHEMISTRY,
      {
        title: "Duplicate section",
        topics: [
          { id: "chem-1", title: "Chemistry topic 1" },
          { id: "chem-2", title: "Chemistry topic 2" },
        ],
      },
    ];
    const options = pathwaySectionOptions(units, "chem-1");
    expect(options.map((option) => option.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `chem-${index + 1}`),
    );
  });

  test("the helper still honours the hard server limit for a longer course", () => {
    const long = [
      {
        title: "Long course",
        topics: Array.from({ length: 20 }, (_, index) => ({
          id: `long-${index + 1}`,
          title: `Topic ${index + 1}`,
        })),
      },
    ];
    expect(pathwaySectionOptions(long, "long-1")).toHaveLength(
      MAX_COMBINED_TOPICS,
    );
  });

  test("an unknown topic produces no options", () => {
    expect(pathwaySectionOptions(CHEMISTRY, "missing")).toEqual([]);
  });

  test("the whole-course list keeps every topic and numbers it across units", () => {
    const units = [
      {
        title: "First unit",
        topics: [
          { id: "first", title: "Cell structure" },
          { id: "second", title: "Cell division" },
        ],
      },
      {
        title: "Second unit",
        topics: [{ id: "third", title: "Transport in cells" }],
      },
    ];

    expect(
      pathwayTopicOptions(units).map(({ number, title }) => ({
        number,
        title,
      })),
    ).toEqual([
      { number: 1, title: "Cell structure" },
      { number: 2, title: "Cell division" },
      { number: 3, title: "Transport in cells" },
    ]);
  });

  test("whole-course topics keep their course number when a run starts later", () => {
    const options = pathwaySectionOptions(CHEMISTRY, "chem-8");
    expect(options.map((option) => option.number)).toEqual([8, 9, 10]);
  });

  test("the Edexcel Physics pathway stays 15 parts and 33 topics in the builder", () => {
    // Edexcel GCSE Physics (1PH0) has 15 specification topics; the pathway
    // shows those as 15 parts, with 33 topics across them.
    const units = Array.from({ length: 15 }, (_, unitIndex) => ({
      title: `Topic ${unitIndex + 1}`,
      topics: Array.from(
        { length: unitIndex < 12 ? 2 : 3 },
        (_, topicIndex) => ({
          id: `physics-${unitIndex + 1}-${topicIndex + 1}`,
          title: `Subtopic ${unitIndex + 1}.${topicIndex + 1}`,
        }),
      ),
    }));

    const parts = pathwayPartOptions(units);
    expect(parts).toHaveLength(15);
    expect(parts.map((part) => part.number)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
    expect(parts.reduce((sum, part) => sum + part.topicCount, 0)).toBe(33);
    expect(pathwayTopicOptions(units)).toHaveLength(33);
    expect(parts[0]).toMatchObject({
      title: "Topic 1",
      topicIds: ["physics-1-1", "physics-1-2"],
      topicCount: 2,
    });
    expect(pathwayPartIdsForTopics(parts, ["physics-1-1"])).toEqual(["part-1"]);
    expect(
      pathwayPartIdsForTopics(parts, ["physics-1-1", "physics-15-3"]),
    ).toEqual(["part-1", "part-15"]);
  });
});
