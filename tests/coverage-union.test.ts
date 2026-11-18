import { describe, expect, test } from "bun:test";

import type { QueryCtx } from "../src/convex/_generated/server";
import { forSet } from "../src/convex/coverage";

type Row = Record<string, any> & { _id: string };

const USER = "user:one";
const SET = "set:one";

/** The bits of a query context `coverage.forSet` reads: auth, get and by_set. */
function fakeQueryContext(tables: Record<string, Row[]>) {
  const db = {
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((row) => row._id === id) ?? null,
    query: (table: string) => ({
      withIndex: (_index: string, build?: (query: any) => any) => {
        const filters: Array<[string, unknown]> = [];
        const query = {
          eq: (field: string, value: unknown) => {
            filters.push([field, value]);
            return query;
          },
        };
        build?.(query);
        const rows = (tables[table] ?? []).filter((row) =>
          filters.every(([field, value]) => row[field] === value),
        );
        return { collect: async () => rows };
      },
    }),
  };
  return {
    auth: { getUserIdentity: async () => ({ subject: USER }) },
    db,
  } as unknown as QueryCtx;
}

async function coverageFor(tables: Record<string, Row[]>) {
  const ctx = fakeQueryContext(tables);
  return await (forSet as any)._handler(ctx, { setId: SET });
}

describe("specification coverage for one set", () => {
  test("counts a statement covered when a key point or an item is tagged to it", async () => {
    // The summary has one key point, so the links alone can only ever report
    // 1 of these 4 statements. A multi-topic set is in exactly that position:
    // its cards and questions are tagged to far more statements than its
    // summary links, and those tags are what the material actually covers.
    const data = await coverageFor({
      studySets: [
        {
          _id: SET,
          userId: USER,
          specPoints: [
            { id: "t1:0", text: "1.1 Atoms" },
            { id: "t1:1", text: "1.2 Bonding" },
            { id: "t2:0", text: "2.1 Rates of reaction" },
            { id: "t2:1", text: "2.2 Equilibrium" },
          ],
          summary: {
            overview: "",
            keyPoints: ["Atoms are made of protons, neutrons and electrons"],
            keyPointSpecs: [
              {
                text: "Atoms are made of protons, neutrons and electrons",
                specRef: "t1:0",
              },
            ],
            examFocus: [],
          },
        },
      ],
      flashcards: [
        {
          _id: "card:1",
          setId: SET,
          specRef: "t1:1",
          front: "Why do atoms form covalent bonds?",
          back: "To share electrons.",
        },
        {
          _id: "card:2",
          setId: SET,
          front: "Untagged card",
          back: "Nothing to match.",
        },
      ],
      quizQuestions: [
        {
          _id: "quiz:1",
          setId: SET,
          specRef: "t2:0",
          question: "What increases the rate of a reaction?",
        },
      ],
      examQuestions: [
        {
          _id: "exam:1",
          setId: SET,
          question: "Untagged written question",
        },
      ],
    });

    expect(data.coverage.covered.map((point: any) => point.id)).toEqual([
      "t1:0",
      "t1:1",
      "t2:0",
    ]);
    expect(data.coverage.uncovered.map((point: any) => point.id)).toEqual([
      "t2:1",
    ]);
    expect(data.coverage.total).toBe(4);
    expect(data.coverage.percent).toBe(75);
    // A statement with a card behind it is not reported as missing.
    expect(data.missingKeyPoints.map((point: any) => point.id)).toEqual([
      "t2:1",
    ]);
    expect(data.tagged).toEqual({
      cards: 1,
      cardsTotal: 2,
      quiz: 1,
      quizTotal: 1,
      exam: 0,
      examTotal: 1,
    });
  });

  test("does not count a tag that is not one of this set's statements", async () => {
    // A statement id from another build (or an older pathway) must not tick a
    // different statement, and no tag at all leaves the whole list uncovered.
    const data = await coverageFor({
      studySets: [
        {
          _id: SET,
          userId: USER,
          specPoints: [
            { id: "t1:0", text: "1.1 Atoms" },
            { id: "t1:1", text: "1.2 Bonding" },
          ],
          summary: {
            overview: "",
            keyPoints: ["Atoms bond"],
            keyPointSpecs: [],
            examFocus: [],
          },
        },
      ],
      flashcards: [
        { _id: "card:1", setId: SET, specRef: "old:9", front: "Bonding", back: "…" },
      ],
      quizQuestions: [],
      examQuestions: [],
    });

    expect(data.coverage.covered).toEqual([]);
    expect(data.coverage.uncovered.map((point: any) => point.id)).toEqual([
      "t1:0",
      "t1:1",
    ]);
    expect(data.coverage.percent).toBe(0);
  });
});
