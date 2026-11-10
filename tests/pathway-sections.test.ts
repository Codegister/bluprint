import { describe, expect, test } from "bun:test";

import {
  MAX_COMBINED_TOPICS,
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
      pathwayTopicOptions(units).map(({ number, title }) => ({ number, title })),
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
});
