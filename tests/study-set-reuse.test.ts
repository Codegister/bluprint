import { describe, expect, test } from "bun:test";

import { internal } from "../src/convex/_generated/api";
import type { MutationCtx } from "../src/convex/_generated/server";
import {
  continueStudySetCards,
  continueStudySetExams,
  continueStudySetQuiz,
  processStudySetScheduled,
  resumeStaleStudySet,
} from "../src/convex/ai";
import { refund } from "../src/convex/buildUsage";
import { createTopicSetForTutor } from "../src/convex/courses";
import {
  appendCards,
  claimBackgroundRetry,
  claimContinuation,
  claimForProcessing,
  completeGeneration,
  failGeneration,
  finishGeneration,
  getBuildSnapshot,
  getForProcessing,
  isActive,
  markReady,
  setProgress,
} from "../src/convex/studySets";
import {
  copyCachedReuse,
  copyCachedStudySet,
  copyMeetsRequest,
  copyStudySetContent,
  findSimilarCachedStudySet,
  findSimilarOwnedStudySet,
  grownStudySetTargets,
  notesSimilarity,
  studySetAnswersRequest,
  studySetGrowthTargets,
  rememberStudySetForReuse,
  studySetReuseKey,
  studySetReuseKeyForSet,
} from "../src/convex/lib/studySetReuse";

type Row = Record<string, any> & { _id: string };
type Tables = Record<string, Row[]>;

function fakeContext(tables: Tables) {
  let nextId = 0;
  const allRows = () => Object.values(tables).flat();

  const db = {
    get: async (id: string) => allRows().find((row) => row._id === id) ?? null,
    insert: async (table: string, document: Record<string, any>) => {
      const row = { ...document, _id: `${table}:${++nextId}` };
      (tables[table] ??= []).push(row);
      return row._id;
    },
    patch: async (id: string, patch: Record<string, any>) => {
      const row = allRows().find((candidate) => candidate._id === id);
      if (!row) throw new Error(`Missing row ${id}`);
      Object.assign(row, patch);
    },
    delete: async (id: string) => {
      for (const [table, rows] of Object.entries(tables)) {
        const index = rows.findIndex((row) => row._id === id);
        if (index !== -1) {
          rows.splice(index, 1);
          return;
        }
        void table;
      }
    },
    query: (table: string) => {
      const matching = (build?: (query: any) => any) => {
        const filters: Array<[string, unknown]> = [];
        const query = {
          eq: (field: string, value: unknown) => {
            filters.push([field, value]);
            return query;
          },
        };
        build?.(query);
        return (tables[table] ?? []).filter((row) =>
          filters.every(([field, value]) => row[field] === value),
        );
      };
      return {
        withIndex: (_index: string, build: (query: any) => any) => {
          const rows = matching(build);
          return {
            first: async () => rows[0] ?? null,
            collect: async () => rows,
            order: (_direction: "asc" | "desc") => ({
              collect: async () => rows,
            }),
          };
        },
        collect: async () => matching(),
      };
    },
  };

  return { ctx: { db } as unknown as MutationCtx, tables, db };
}

/**
 * Answers the flashcard fact-check request with "keep every card". These tests
 * script the card, quiz and exam prompts they care about; the reviewer is a
 * separate call, so it gets a fixed approval instead of another script branch.
 */
function cardReviewResponse(prompt: string): Response {
  const count = (prompt.match(/^\d+\. Q: /gm) ?? []).length;
  const verdicts = Array.from({ length: count }, (_, index) => ({
    card: index + 1,
    verdict: "keep",
    reason: "",
  }));
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ verdicts }) } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const NOTES =
  "Course: GCSE Biology\nExam board: AQA\nTopic: Cell structure\nCells contain organelles.";

function sourceSet(overrides: Record<string, any> = {}): Row {
  return {
    _id: "set:source",
    userId: "user:source",
    title: "Cell structure",
    titleSource: "auto",
    notes: NOTES,
    sourceType: "text",
    sourceLabel: "Course pathway",
    course: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    courseId: "course:source",
    topicId: "cell-structure",
    topicIds: ["cell-structure"],
    sourceImageIds: [],
    status: "ready",
    summary: {
      overview: "Cells contain organelles.",
      keyPoints: ["Cells contain organelles."],
      examFocus: ["Cell structure"],
    },
    cardCount: 2,
    quizCount: 1,
    examCount: 1,
    targetCardCount: 10,
    targetQuizCount: 5,
    targetExamCount: 3,
    knownCount: 1,
    updatedAt: 100,
    ...overrides,
  };
}

function rowsForSource(setId: string): Tables {
  return {
    studySets: [sourceSet({ _id: setId })],
    flashcards: [
      {
        _id: "card:1",
        setId,
        userId: "user:source",
        front: "What do cells contain?",
        back: "Organelles.",
        order: 0,
        status: "known",
        reviewCount: 4,
        lastReviewedAt: 50,
        lastRating: 4,
        dueAt: 200,
        stability: 12,
        recallThreshold: 0.75,
        recallUnits: ["organelles"],
      },
      {
        _id: "card:2",
        setId,
        userId: "user:source",
        front: "What controls the cell?",
        back: "The membrane.",
        order: 1,
        status: "new",
        reviewCount: 0,
      },
    ],
    quizQuestions: [
      {
        _id: "quiz:1",
        setId,
        userId: "user:source",
        question: "Which organelle releases energy?",
        options: ["Mitochondria", "Nucleus", "Ribosome", "Vacuole"],
        correctIndex: 0,
        explanation: "Mitochondria release energy.",
        order: 0,
        sourceCardId: "card:1",
        missCount: 3,
        correctCount: 1,
        lastAnswer: "Nucleus",
        lastCorrect: false,
      },
    ],
    examQuestions: [
      {
        _id: "exam:1",
        setId,
        userId: "user:source",
        question: "Describe the function of the cell membrane.",
        marks: 2,
        modelAnswer: "It controls what enters and leaves the cell.",
        markingGuide: ["Controls entry", "Controls exit"],
        order: 0,
        userAnswer: "It is a barrier.",
        awardedMarks: 1,
        feedback: "Add control of exit.",
        gradedAt: 60,
        criteria: [
          { id: "1", marks: 1, text: "Controls entry" },
          { id: "2", marks: 1, text: "Controls exit" },
        ],
      },
    ],
    studySetCache: [],
  };
}

const cacheArgs = (cacheKey: string) => ({
  cacheKey,
  userId: "user:new",
  courseId: "course:new",
  title: "Cell structure",
  notes: NOTES,
  sourceLabel: "Course pathway",
  course: "Biology",
  examBoard: "AQA",
  level: "GCSE",
  topicId: "cell-structure",
  topicIds: ["cell-structure"],
  specPoints: [],
  targetCardCount: 10,
  targetQuizCount: 5,
  targetExamCount: 3,
});

const FUNCTION_NAME = Symbol.for("functionName");

type InternalHandler = {
  _handler: (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
};

/**
 * A student with no personal NVIDIA key saved.
 *
 * Every generation stage resolves its keys before it starts, so the action asks
 * for this row first. Production answers null when the account has not connected
 * a key, and the build runs on the shared pool; the real query reads a table this
 * fixture does not carry, so the answer is given directly rather than through the
 * in-memory database. A test that needs a personal key would stub a ciphertext
 * here instead.
 */
const noStoredUserKey: InternalHandler = {
  _handler: async () => null,
};

function functionNameOf(ref: unknown): string {
  return String((ref as Record<symbol, unknown>)[FUNCTION_NAME]);
}

/**
 * A small action context for the generation action. The real internal functions
 * receive the same in-memory database as `fakeContext`, so the test exercises
 * the production copy, generation and merge handlers rather than reimplementing
 * their writes.
 */
function actionContext(
  tables: Tables,
  options: { captureSchedule?: boolean } = {},
) {
  const { ctx: dbCtx } = fakeContext(tables);
  const scheduled: Array<{
    delay: number;
    name: string;
    args: Record<string, unknown>;
  }> = [];
  const functions: Array<[unknown, InternalHandler]> = [
    [internal.studySets.getForProcessing, getForProcessing as unknown as InternalHandler],
    [internal.studySets.claimForProcessing, claimForProcessing as unknown as InternalHandler],
    [internal.studySets.claimBackgroundRetry, claimBackgroundRetry as unknown as InternalHandler],
    [internal.studySets.markReady, markReady as unknown as InternalHandler],
    [internal.studySets.claimContinuation, claimContinuation as unknown as InternalHandler],
    [internal.studySets.getBuildSnapshot, getBuildSnapshot as unknown as InternalHandler],
    [internal.studySets.setProgress, setProgress as unknown as InternalHandler],
    [internal.studySets.isActive, isActive as unknown as InternalHandler],
    [internal.studySets.completeGeneration, completeGeneration as unknown as InternalHandler],
    [internal.studySets.appendCards, appendCards as unknown as InternalHandler],
    [internal.studySets.failGeneration, failGeneration as unknown as InternalHandler],
    [internal.studySets.finishGeneration, finishGeneration as unknown as InternalHandler],
    [internal.userKeys.getStored, noStoredUserKey],
    [internal.buildUsage.refund, refund as unknown as InternalHandler],
  ];
  const byName = new Map(
    functions.map(([ref, fn]) => [functionNameOf(ref), fn]),
  );

  const run = async (ref: unknown, args: Record<string, unknown>) => {
    const fn = byName.get(functionNameOf(ref));
    if (!fn) throw new Error(`Unexpected internal function ${functionNameOf(ref)}`);
    return await fn._handler(dbCtx, args);
  };

  return {
    runQuery: run,
    runMutation: run,
    scheduled,
    scheduler: {
      runAfter: async (
        delay: number,
        ref: unknown,
        args: Record<string, unknown> = {},
      ) => {
        const name = functionNameOf(ref);
        scheduled.push({ delay, name, args });
        // Watchdogs are background no-ops in these tests; every stage they
        // guard is exercised directly.
        if (name === "ai:resumeStaleStudySet") return;
        if (options.captureSchedule) return;
        throw new Error(`Unexpected scheduled function ${name}`);
      },
    },
  };
}

describe("study set reuse", () => {
  test("a finished copy only answers a build of the same size", () => {
    expect(
      copyMeetsRequest(
        { cardCount: 13, quizCount: 7, examCount: 4 },
        { cards: 10, quiz: 5, exam: 3 },
      ),
    ).toBe(true);
    // The reported tutor build: an old ten-card set cannot answer 100 of each,
    // and the review that follows adds three cards, not ninety.
    expect(
      copyMeetsRequest(
        { cardCount: 10, quizCount: 3, examCount: 1 },
        { cards: 100, quiz: 100, exam: 100 },
      ),
    ).toBe(false);
  });

  test("a short big build finishes ready with the honest count", async () => {
    const tables = rowsForSource("set:short");
    const set = tables.studySets[0]!;
    set.status = "processing";
    set.progress = "Saving your set…";
    set.autoRetryCount = 2;
    set.cardCount = 100;
    set.quizCount = 84;
    set.examCount = 91;
    set.targetCardCount = 100;
    set.targetQuizCount = 100;
    set.targetExamCount = 100;
    const { ctx } = fakeContext(tables);

    await finishGeneration._handler(ctx, { setId: "set:short" });

    // Finished, not failed: the set opens and the note says what it built
    // against the target of a hundred, not that it was never marked ready.
    expect(set.status).toBe("ready");
    expect(set.progress).toBeUndefined();
    expect(set.autoRetryCount).toBeUndefined();
    expect(set.generationNote).toBe(
      "Built 84 of 100 quiz questions. Built 91 of 100 exam questions.",
    );
  });

  test("a pathway build that ends short finishes ready with the built count", async () => {
    const tables = rowsForSource("set:pathway-short");
    const set = tables.studySets[0]!;
    set.courseId = "course:source";
    set.notes = [
      "Course: GCSE Biology",
      "Exam board: AQA",
      "Syllabus scope for this set:",
      "Topic: Cell structure",
      "Cells contain organelles that carry out specialised functions.",
      "The nucleus stores genetic material and controls the cell.",
    ].join("\n");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.generationNote = undefined;
    set.cardCount = 1;
    set.quizCount = 0;
    set.examCount = 0;
    set.targetCardCount = 1;
    set.targetQuizCount = 100;
    set.targetExamCount = 100;
    // Automatic top-ups are already spent: the next shortfall is final.
    set.autoRetryCount = 3;
    tables.flashcards = [
      {
        ...tables.flashcards[0]!,
        _id: "card:pathway",
        setId: "set:pathway-short",
        userId: "user:source",
        front: "What do cells contain?",
        back: "Organelles.",
        order: 0,
      },
    ];
    tables.quizQuestions = [];
    tables.examQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      let content: string;
      if (prompt.includes("quiz questions")) {
        // One question per call against a hundred-question target: the live
        // generator's short finish.
        content = JSON.stringify({
          questions: [
            {
              question: "Which organelle controls the cell?",
              type: "typed",
              answer: "nucleus",
              acceptedAnswers: ["nucleus"],
              explanation:
                "The nucleus stores genetic material and controls the cell.",
            },
          ],
        });
      } else if (prompt.includes("marking guide")) {
        content = JSON.stringify({
          questions: [
            {
              question: "Describe the role of the nucleus in a cell.",
              marks: 2,
              modelAnswer:
                "The nucleus stores genetic material and controls the cell.",
              markingGuide: [
                "1 mark: stores genetic material",
                "1 mark: controls the cell",
              ],
            },
          ],
        });
      } else {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const action = actionContext(tables, { captureSchedule: true });
      const scheduledHandler = processStudySetScheduled as unknown as {
        _handler: (
          ctx: unknown,
          args: { setId: string; userId: string },
        ) => Promise<unknown>;
      };
      await scheduledHandler._handler(action, {
        setId: "set:pathway-short",
        userId: "user:source",
      });
      const quizContinuation = action.scheduled.find(
        ({ name }) => name === "ai:continueStudySetQuiz",
      );
      expect(quizContinuation).toBeDefined();
      const continuation = continueStudySetQuiz as unknown as {
        _handler: (
          ctx: unknown,
          args: Record<string, unknown>,
        ) => Promise<{ continued: boolean; finished?: boolean }>;
      };
      await continuation._handler(action, quizContinuation!.args);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    // Finished, not failed: the set opens and the note states the honest count
    // against the hundred-question target rather than an error.
    expect(set.status).toBe("ready");
    expect(set.progress).toBeUndefined();
    expect(set.errorMessage).toBeUndefined();
    expect(set.autoRetryCount).toBeUndefined();
    expect(set.generationNote).toMatch(/Built \d+ of 100 quiz questions\./);
    expect(set.cardCount).toBe(1);
  });

  test("the set for the same topics is grown, never duplicated", () => {
    const asked = { cards: 100, quiz: 100, exam: 100 };
    const short = {
      status: "ready",
      cardCount: 10,
      quizCount: 3,
      examCount: 1,
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    };
    // The reported build: an existing ten-card set is not the answer to a
    // hundred-card request, and it is grown in place instead of copied.
    expect(studySetAnswersRequest(short, asked)).toBe(false);
    expect(grownStudySetTargets(short, asked)).toEqual(asked);

    const full = {
      ...short,
      cardCount: 100,
      quizCount: 100,
      examCount: 100,
      targetCardCount: 100,
      targetQuizCount: 100,
      targetExamCount: 100,
    };
    expect(studySetAnswersRequest(full, asked)).toBe(true);
    // Growing a larger set towards a smaller request never shrinks it.
    expect(grownStudySetTargets(full, { cards: 10, quiz: 5, exam: 3 })).toEqual(
      { cards: 100, quiz: 100, exam: 100 },
    );

    // A set still building at this size is this build; it must not be grown a
    // second time while its own run is filling it.
    const building = {
      ...short,
      status: "processing",
      cardCount: 12,
      targetCardCount: 100,
      targetQuizCount: 100,
      targetExamCount: 100,
    };
    expect(studySetAnswersRequest(building, asked)).toBe(true);

    // A ready set already aimed at the hundred, which finished short, is not
    // grown again: there is nothing left to raise, so the honest note stands
    // and a repeat request schedules no second paid run.
    const aimedShort = {
      ...short,
      cardCount: 56,
      quizCount: 84,
      examCount: 91,
      targetCardCount: 100,
      targetQuizCount: 100,
      targetExamCount: 100,
    };
    expect(studySetAnswersRequest(aimedShort, asked)).toBe(false);
    expect(studySetGrowthTargets(aimedShort, asked)).toBeUndefined();
    // A set still below the request is grown to it.
    expect(studySetGrowthTargets(short, asked)).toEqual(asked);
  });

  test("a ready set already aimed at the request is reopened without another charge", async () => {
    const course = {
      _id: "course:source",
      userId: "user:source",
      subject: "Biology",
      level: "GCSE",
      examBoard: "AQA",
      tier: "Higher",
      status: "ready",
      completedTopics: [],
      pathway: {
        overview: "Cells and their organelles.",
        examFormat: "Paper 1",
        units: [
          {
            title: "Cells",
            summary: "Cell structure.",
            topics: [
              {
                id: "cell-structure",
                title: "Cell structure",
                summary:
                  "Cells contain organelles that carry out specialised functions.",
                keyPoints: ["The nucleus stores genetic material."],
                examSkill: "Describe the function of an organelle.",
              },
            ],
          },
        ],
      },
      createdAt: 1,
      updatedAt: 1,
    };
    const set = sourceSet({
      _id: "set:short",
      userId: "user:source",
      courseId: "course:source",
      // Finished short of its own hundred: the honest note already says so.
      status: "ready",
      cardCount: 56,
      quizCount: 84,
      examCount: 91,
      targetCardCount: 100,
      targetQuizCount: 100,
      targetExamCount: 100,
      generationNote:
        "Built 56 of 100 flashcards. Built 84 of 100 quiz questions. Built 91 of 100 exam questions.",
    });
    const tables: Tables = {
      users: [{ _id: "user:source", emailVerificationTime: 1 }],
      courses: [course],
      studySets: [set],
      flashcards: [],
      quizQuestions: [],
      examQuestions: [],
      studySetCache: [],
      buildUsage: [],
    };
    const { ctx: base } = fakeContext(tables);
    const scheduled: string[] = [];
    const ctx = {
      db: (base as unknown as { db: unknown }).db,
      scheduler: {
        runAfter: async (_delay: number, ref: unknown) => {
          scheduled.push(functionNameOf(ref));
        },
      },
    } as unknown as MutationCtx;

    const handler = (createTopicSetForTutor as unknown as {
      _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
    })._handler;
    const result = await handler(ctx, {
      userId: "user:source",
      courseId: "course:source",
      topicId: "cell-structure",
      topicIds: ["cell-structure"],
      targetCardCount: 100,
      targetQuizCount: 100,
      targetExamCount: 100,
    });

    // Reopened, not rebuilt: no second set, no growth run and no allowance
    // spent on a size the set was already aimed at.
    expect(result).toMatchObject({
      setId: "set:short",
      created: false,
      scheduled: false,
    });
    expect(tables.studySets).toHaveLength(1);
    expect(tables.buildUsage).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
    expect(set.status).toBe("ready");
    expect(set.generationNote).toContain("Built 56 of 100 flashcards");
  });

  test("clones a finished course set into a clean private copy", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    const key = studySetReuseKeyForSet(source as any);
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: key,
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const setId = await copyCachedStudySet(ctx, cacheArgs(key));

    expect(setId).not.toBeNull();
    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.userId).toBe("user:new");
    expect(copy.courseId).toBe("course:new");
    expect(copy.status).toBe("ready");
    expect(copy.knownCount).toBe(0);
    expect(copy.cardCount).toBe(2);
    expect(copy.quizCount).toBe(1);
    expect(copy.examCount).toBe(1);

    const cards = tables.flashcards.filter((row) => row.setId === setId);
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What controls the cell?",
    ]);
    expect(cards.every((card) => card.userId === "user:new")).toBe(true);
    expect(cards.every((card) => card.status === "new")).toBe(true);
    expect(cards.every((card) => card.reviewCount === 0)).toBe(true);
    expect(cards.every((card) => card.lastReviewedAt === undefined)).toBe(true);
    expect(cards[0]!.recallThreshold).toBe(0.75);

    const quiz = tables.quizQuestions.filter((row) => row.setId === setId);
    expect(quiz).toHaveLength(1);
    expect(quiz[0]!.userId).toBe("user:new");
    expect(quiz[0]!.missCount).toBe(0);
    expect(quiz[0]!.correctCount).toBe(0);
    expect(quiz[0]!.lastAnswer).toBeUndefined();
    expect(quiz[0]!.sourceCardId).toBeUndefined();

    const exams = tables.examQuestions.filter((row) => row.setId === setId);
    expect(exams).toHaveLength(1);
    expect(exams[0]!.userId).toBe("user:new");
    expect(exams[0]!.userAnswer).toBeUndefined();
    expect(exams[0]!.awardedMarks).toBeUndefined();
    expect(exams[0]!.gradedAt).toBeUndefined();
    expect(exams[0]!.criteria).toHaveLength(2);

    expect(tables.studySetCache[0]!.uses).toBe(1);
    expect(tables.studySets.find((row) => row._id === "set:source")!.knownCount).toBe(
      1,
    );
  });

  test("rejects a cache row whose source was rebuilt under different inputs", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    const key = studySetReuseKeyForSet(source as any);
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: key,
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    // The source now covers a different topic but still has the old cache key.
    tables.studySets[0]!.topicIds = ["cell-transport"];
    tables.studySets[0]!.notes = `${NOTES}\nTopic: Cell transport`;
    const { ctx } = fakeContext(tables);

    expect(await copyCachedStudySet(ctx, cacheArgs(key))).toBeNull();
    expect(tables.studySetCache).toHaveLength(0);
    expect(tables.studySets).toHaveLength(1);
  });

  test("keeps a reviewed set reusable after its counts grow past the target", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    const cardTemplate = tables.flashcards[0]!;
    for (let index = 2; index < 13; index += 1) {
      tables.flashcards.push({
        ...cardTemplate,
        _id: `card:${index + 1}`,
        order: index,
        front: `Extra card ${index + 1}?`,
        back: `Extra answer ${index + 1}.`,
      });
    }
    const quizTemplate = tables.quizQuestions[0]!;
    for (let index = 1; index < 7; index += 1) {
      tables.quizQuestions.push({
        ...quizTemplate,
        _id: `quiz:${index + 1}`,
        order: index,
        question: `Extra quiz ${index + 1}?`,
      });
    }
    const examTemplate = tables.examQuestions[0]!;
    for (let index = 1; index < 4; index += 1) {
      tables.examQuestions.push({
        ...examTemplate,
        _id: `exam:${index + 1}`,
        order: index,
        question: `Extra exam ${index + 1}?`,
      });
    }
    source.cardCount = 13;
    source.quizCount = 7;
    source.examCount = 4;
    const key = studySetReuseKeyForSet(source as any);
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: key,
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const setId = await copyCachedStudySet(ctx, cacheArgs(key));

    expect(setId).not.toBeNull();
    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.cardCount).toBe(13);
    expect(copy.quizCount).toBe(7);
    expect(copy.examCount).toBe(4);
  });

  test("remembers only completed course sets, never uploads", async () => {
    const tables = rowsForSource("set:source");
    const { ctx } = fakeContext(tables);
    await rememberStudySetForReuse(ctx, "set:source");
    expect(tables.studySetCache).toHaveLength(1);
    expect(tables.studySetCache[0]!.sourceSetId).toBe("set:source");

    const uploaded = sourceSet({
      _id: "set:upload",
      sourceImageIds: ["image:1"],
    });
    tables.studySets.push(uploaded);
    await rememberStudySetForReuse(ctx, "set:upload");
    expect(tables.studySetCache).toHaveLength(1);
  });

  test("reuses a course set whose counts differ, as long as it covers the topics", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "some-old-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["cell-structure"],
      targetCardCount: 20,
      targetQuizCount: 10,
      targetExamCount: 5,
    });
    expect(match?.source._id).toBe("set:source");

    const setId = await copyCachedReuse(ctx, match!, {
      ...cacheArgs(""),
      targetCardCount: 20,
      targetQuizCount: 10,
      targetExamCount: 5,
    });
    expect(setId).not.toBeNull();
    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.status).toBe("ready");
    expect(copy.cardCount).toBe(2);
    expect(copy.targetCardCount).toBe(20);
    expect(tables.studySetCache[0]!.uses).toBe(1);
  });

  test("reuses the overlapping topics when the selection is wider", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.topicIds = ["cell-structure"];
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "some-old-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["cell-structure", "cell-transport"],
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });
    expect(match?.matchedTopicIds).toEqual(["cell-structure"]);
    expect(match?.missingTopicIds).toEqual(["cell-transport"]);

    const setId = await copyCachedReuse(ctx, match!, {
      ...cacheArgs(""),
      topicId: "cell-structure",
      topicIds: ["cell-structure", "cell-transport"],
      sourceTopicIds: match!.matchedTopicIds,
      generationNotes: `${NOTES}\nTopic: Cell transport`,
      titleSource: "user",
    });
    expect(setId).not.toBeNull();

    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.status).toBe("queued");
    expect(copy.topicIds).toEqual(["cell-structure", "cell-transport"]);
    expect(copy.cardCount).toBe(2);
    expect(copy.quizCount).toBe(1);
    expect(copy.examCount).toBe(1);
    expect(copy.generationNotes).toContain("Cell transport");
    expect(copy.summary).toBeUndefined();
    expect(tables.flashcards.filter((row) => row.setId === setId)).toHaveLength(2);
    expect(tables.studySetCache[0]!.uses).toBe(1);
  });

  test("never reuses a different Shakespeare play that shares a topic slot", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.course = "English Literature";
    source.examBoard = "AQA";
    source.level = "GCSE";
    source.topicId = "a1t2";
    source.topicIds = ["a1t2"];
    source.notes = [
      "Course: GCSE English Literature",
      "Exam board: AQA",
      "Course options: Shakespeare: Romeo & Juliet",
      "",
      "Syllabus scope for this set:",
      "",
      "Topic: Shakespeare",
      "Unit: Shakespeare",
      "Romeo and Juliet fall in love despite their families' feud.",
      "Covers:",
      "- The prologue frames the play as a tragedy.",
    ].join("\n");
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "romeo-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "English Literature",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["a1t2"],
      notes: [
        "Course: GCSE English Literature",
        "Exam board: AQA",
        "Course options: Shakespeare: Macbeth",
        "",
        "Syllabus scope for this set:",
        "",
        "Topic: Shakespeare",
        "Unit: Shakespeare",
        "Macbeth's ambition drives him to murder and tyranny.",
        "Covers:",
        "- The witches' prophecy sets the tragedy in motion.",
      ].join("\n"),
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });

    expect(match).toBeNull();
  });

  test("never reuses a different RS religion that shares a topic slot", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.course = "Religious Studies";
    source.examBoard = "Edexcel";
    source.level = "GCSE";
    source.topicId = "u1t1";
    source.topicIds = ["u1t1"];
    source.notes = [
      "Course: GCSE Religious Studies",
      "Exam board: Edexcel",
      "",
      "Syllabus scope for this set:",
      "",
      "Topic: Beliefs and practices — Islam",
      "Unit: Beliefs and practices — Islam",
      "The core beliefs and practices of Islam.",
      "Covers:",
      "- The Five Pillars shape Muslim practice.",
    ].join("\n");
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "islam-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Religious Studies",
      examBoard: "Edexcel",
      level: "GCSE",
      topicIds: ["u1t1"],
      notes: [
        "Course: GCSE Religious Studies",
        "Exam board: Edexcel",
        "",
        "Syllabus scope for this set:",
        "",
        "Topic: Beliefs and practices — Christianity",
        "Unit: Beliefs and practices — Christianity",
        "The core beliefs and practices of Christianity.",
        "Covers:",
        "- The Trinity shapes Christian belief.",
      ].join("\n"),
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });

    expect(match).toBeNull();
  });

  test("matches a topic by title when a pathway version renumbers it", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.topicIds = ["old-cell-structure"];
    source.topicId = "old-cell-structure";
    source.specPoints = [
      { id: "old-cell-structure:0", text: "4.1.1.1 Cells contain organelles." },
    ];
    source.notes = [
      "Course: GCSE Biology",
      "Exam board: AQA",
      "",
      "Syllabus scope for this set:",
      "",
      "Topic: Cell structure (specification 4.1.1.1)",
      "Unit: Cell biology",
      "Cells contain organelles that carry out specialised functions.",
      "Covers:",
      "- Cells contain organelles.",
    ].join("\n");
    for (const row of [
      ...tables.flashcards,
      ...tables.quizQuestions,
      ...tables.examQuestions,
    ]) {
      row.specRef = "old-cell-structure:0";
    }
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "old-source-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });

    const queryNotes = [
      "Course: GCSE Biology",
      "Exam board: AQA",
      "",
      "Syllabus scope for this set:",
      "",
      "Section 1: Cell structure (specification 4.1.1.1)",
      "Unit: Cell biology",
      "Cells contain organelles that carry out specialised functions.",
      "Covers:",
      "- Cells contain organelles.",
      "",
      "Section 2: Photosynthesis",
      "Unit: Bioenergetics",
      "Photosynthesis uses light energy to make glucose and oxygen.",
      "Covers:",
      "- Photosynthesis releases oxygen.",
    ].join("\n");
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["new-cell-structure", "new-photosynthesis"],
      notes: queryNotes,
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });
    expect(match?.matchedTopicIds).toEqual(["new-cell-structure"]);
    expect(match?.matchedSourceTopicIds).toEqual(["old-cell-structure"]);
    expect(match?.missingTopicIds).toEqual(["new-photosynthesis"]);

    const setId = await copyCachedReuse(ctx, match!, {
      ...cacheArgs(""),
      title: "Cells and photosynthesis",
      notes: queryNotes,
      topicId: "new-cell-structure",
      topicIds: ["new-cell-structure", "new-photosynthesis"],
      specPoints: [
        { id: "new-cell-structure:0", text: "4.1.1.1 Cells contain organelles." },
        { id: "new-photosynthesis:0", text: "Photosynthesis releases oxygen." },
      ],
      sourceTopicIds: match!.matchedSourceTopicIds,
      sourceTopicIdMap: match!.topicIdMap,
      generationNotes: "Topic: Photosynthesis\nPhotosynthesis uses light energy to make glucose and oxygen.",
      titleSource: "user",
      copyWarnings: false,
    });
    expect(setId).not.toBeNull();
    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.status).toBe("queued");
    expect(copy.topicIds).toEqual(["new-cell-structure", "new-photosynthesis"]);
    expect(copy.cardCount).toBe(2);
    expect(copy.quizCount).toBe(1);
    expect(copy.examCount).toBe(1);
    expect(
      [...tables.flashcards, ...tables.quizQuestions, ...tables.examQuestions]
        .filter((row) => row.setId === setId)
        .every((row) => row.specRef === "new-cell-structure:0"),
    ).toBe(true);
  });

  test("matches a topic by specification content when its title changes", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.topicIds = ["old-cell-structure"];
    source.specPoints = [];
    source.notes = [
      "Course: GCSE Biology",
      "Exam board: AQA",
      "",
      "Syllabus scope for this set:",
      "",
      "Topic: Cell structure",
      "Unit: Cell biology",
      "Cells contain organelles that carry out specialised functions.",
      "Covers:",
      "- Cells contain organelles.",
      "- The nucleus stores genetic material.",
    ].join("\n");
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "old-source-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["new-cell-structure"],
      notes: [
        "Course: GCSE Biology",
        "Exam board: AQA",
        "",
        "Syllabus scope for this set:",
        "",
        "Topic: Cell biology: cell structure",
        "Unit: Cell biology",
        "Cells contain organelles that carry out specialised functions.",
        "Covers:",
        "- Cells contain organelles.",
        "- The nucleus stores genetic material.",
      ].join("\n"),
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });
    expect(match?.matchedTopicIds).toEqual(["new-cell-structure"]);
    expect(match?.matchedSourceTopicIds).toEqual(["old-cell-structure"]);
    expect(match?.missingTopicIds).toEqual([]);
  });

  test("copies only rows tagged to the overlapping topics", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.topicIds = ["cell-structure", "cell-transport"];
    source.specPoints = [
      { id: "cell-structure:0", text: "Cells contain organelles." },
      { id: "cell-transport:0", text: "Membranes control transport." },
    ];
    for (const row of [
      ...tables.flashcards,
      ...tables.quizQuestions,
      ...tables.examQuestions,
    ]) {
      row.specRef = "cell-structure:0";
    }
    tables.flashcards.push({
      ...tables.flashcards[0]!,
      _id: "card:transport",
      order: 2,
      front: "How does diffusion move particles?",
      back: "From high to low concentration.",
      specRef: "cell-transport:0",
    });
    tables.quizQuestions.push({
      ...tables.quizQuestions[0]!,
      _id: "quiz:transport",
      order: 1,
      question: "What is osmosis?",
      specRef: "cell-transport:0",
    });
    tables.examQuestions.push({
      ...tables.examQuestions[0]!,
      _id: "exam:transport",
      order: 1,
      question: "Describe diffusion.",
      specRef: "cell-transport:0",
    });
    source.cardCount = 3;
    source.quizCount = 2;
    source.examCount = 2;
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "some-old-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["cell-structure", "cell-transport", "photosynthesis"],
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });
    expect(match?.matchedTopicIds).toEqual(["cell-structure", "cell-transport"]);
    expect(match?.missingTopicIds).toEqual(["photosynthesis"]);

    const setId = await copyCachedReuse(ctx, match!, {
      ...cacheArgs(""),
      topicIds: ["cell-structure", "photosynthesis"],
      sourceTopicIds: ["cell-structure"],
      generationNotes: `${NOTES}\nTopic: Photosynthesis`,
      titleSource: "user",
    });
    expect(setId).not.toBeNull();

    const cards = tables.flashcards.filter((row) => row.setId === setId);
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What controls the cell?",
    ]);
    expect(cards.some((card) => card.specRef === "cell-transport:0")).toBe(false);
    expect(tables.quizQuestions.filter((row) => row.setId === setId)).toHaveLength(1);
    expect(tables.examQuestions.filter((row) => row.setId === setId)).toHaveLength(1);
  });

  test("reuses a student's own set when their pasted notes overlap", async () => {
    const tables = rowsForSource("set:source");
    const { ctx } = fakeContext(tables);

    const source = await findSimilarOwnedStudySet(ctx, "user:source", {
      notes: `${NOTES}\nCells also have a membrane.`,
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });
    expect(source).not.toBeNull();

    const setId = await copyStudySetContent(ctx, source!, {
      userId: "user:source",
      title: "My notes again",
      titleSource: "user",
      notes: `${NOTES}\nCells also have a membrane.`,
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
      copyWarnings: false,
    });
    expect(setId).not.toBeNull();
    expect(tables.studySets.find((row) => row._id === setId)!.courseId).toBeUndefined();

    expect(
      await findSimilarOwnedStudySet(ctx, "user:other", {
        notes: NOTES,
        targetCardCount: 10,
        targetQuizCount: 5,
        targetExamCount: 3,
      }),
    ).toBeNull();

    expect(
      await findSimilarOwnedStudySet(ctx, "user:source", {
        notes: "Photosynthesis uses light energy to make glucose and oxygen.",
        targetCardCount: 10,
        targetQuizCount: 5,
        targetExamCount: 3,
      }),
    ).toBeNull();
  });

  test("notes similarity follows overlapping text, not exact wording", () => {
    const edited = NOTES.replace("Cells contain organelles.", "Cells contain many organelles.");
    expect(notesSimilarity(NOTES, edited)).toBeGreaterThan(0.55);
    expect(
      notesSimilarity(
        NOTES,
        "Photosynthesis uses light energy to make glucose and oxygen.",
      ),
    ).toBeLessThan(0.55);
  });

  test("a partial-topic reuse generates the missing topic through the scheduled action and merges it", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.topicIds = ["cell-structure"];
    source.specPoints = [
      { id: "cell-structure:0", text: "Cells contain organelles." },
    ];
    for (const row of [
      ...tables.flashcards,
      ...tables.quizQuestions,
      ...tables.examQuestions,
    ]) {
      row.specRef = "cell-structure:0";
    }
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "source-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });

    const notes = [
      "Course: GCSE Biology",
      "Exam board: AQA",
      "Topic: Cell structure",
      "Cells contain organelles that carry out specialised functions.",
      "The nucleus stores genetic material and controls the cell.",
      "Topic: Photosynthesis",
      "Photosynthesis uses light energy to make glucose and oxygen.",
      "Chlorophyll absorbs light energy in the chloroplast.",
      "Photosynthesis releases oxygen as a product.",
    ].join("\n");
    const generationNotes = [
      "Topic: Photosynthesis",
      "Photosynthesis uses light energy to make glucose and oxygen.",
      "Chlorophyll absorbs light energy in the chloroplast.",
      "Photosynthesis releases oxygen as a product.",
    ].join("\n");
    const specPoints = [
      { id: "cell-structure:0", text: "Cells contain organelles." },
      { id: "photosynthesis:0", text: "Photosynthesis uses light energy." },
    ];
    const copyFrom = fakeContext(tables);

    const match = await findSimilarCachedStudySet(copyFrom.ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["cell-structure", "photosynthesis"],
      targetCardCount: 3,
      targetQuizCount: 2,
      targetExamCount: 2,
    });
    expect(match?.matchedTopicIds).toEqual(["cell-structure"]);
    expect(match?.missingTopicIds).toEqual(["photosynthesis"]);

    const partialId = await copyCachedReuse(copyFrom.ctx, match!, {
      ...cacheArgs(""),
      title: "Cells and photosynthesis",
      notes,
      topicId: "cell-structure",
      topicIds: ["cell-structure", "photosynthesis"],
      specPoints,
      targetCardCount: 3,
      targetQuizCount: 2,
      targetExamCount: 2,
      sourceTopicIds: match!.matchedTopicIds,
      generationNotes,
      titleSource: "user",
      copyWarnings: false,
    });
    expect(partialId).not.toBeNull();
    const partial = tables.studySets.find((row) => row._id === partialId)!;
    expect(partial.status).toBe("queued");
    expect(partial.cardCount).toBe(2);
    expect(partial.quizCount).toBe(1);
    expect(partial.examCount).toBe(1);

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    const aiCalls: string[] = [];
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      let content: string;
      if (prompt.includes("Create a revision summary")) {
        aiCalls.push("summary");
        content = JSON.stringify({
          title: "Photosynthesis",
          overview:
            "Photosynthesis uses light energy to make glucose and oxygen in the chloroplast.",
          keyPoints: [
            "Photosynthesis uses light energy.",
            "Chlorophyll absorbs light energy in the chloroplast.",
            "Glucose and oxygen are products of photosynthesis.",
          ],
          examFocus: ["The role of chlorophyll in photosynthesis"],
        });
      } else if (prompt.includes("revision flashcards")) {
        aiCalls.push("cards");
        content = JSON.stringify({
          cards: [
            {
              front: "What is the role of chlorophyll?",
              back: "Chlorophyll absorbs light energy.",
              keyPoint: "Chlorophyll absorbs light energy.",
            },
          ],
        });
      } else if (prompt.includes("quiz questions")) {
        aiCalls.push("quiz");
        content = JSON.stringify({
          questions: [
            {
              question: "Which gas is released as a product of photosynthesis?",
              type: "typed",
              answer: "oxygen",
              acceptedAnswers: ["oxygen"],
              explanation:
                "Oxygen is released because photosynthesis uses light energy to make glucose and oxygen.",
            },
          ],
        });
      } else if (prompt.includes("marking guide")) {
        aiCalls.push("exam");
        content = JSON.stringify({
          questions: [
            {
              question: "Explain how chlorophyll supports photosynthesis.",
              marks: 2,
              modelAnswer:
                "Chlorophyll absorbs light energy, which is used to make glucose and oxygen.",
              markingGuide: [
                "1 mark: chlorophyll absorbs light energy",
                "1 mark: the energy is used to make glucose and oxygen",
              ],
            },
          ],
        });
      } else {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const action = actionContext(tables);
      const scheduledHandler = processStudySetScheduled as unknown as {
        _handler: (
          ctx: unknown,
          args: { setId: string; userId: string },
        ) => Promise<unknown>;
      };
      await scheduledHandler._handler(action, {
        setId: partialId,
        userId: "user:new",
      });
      expect(aiCalls).toEqual(["summary", "cards", "quiz", "exam"]);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    const finished = tables.studySets.find((row) => row._id === partialId)!;
    expect(finished.status).toBe("ready");
    expect(finished.generationNotes).toBeUndefined();
    expect(finished.cardCount).toBe(3);
    expect(finished.quizCount).toBe(2);
    expect(finished.examCount).toBe(2);
    expect(finished.title).toBe("Cells and photosynthesis");
    expect(finished.summary?.overview).toContain("Photosynthesis uses light energy");

    const cards = tables.flashcards.filter((row) => row.setId === partialId);
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What controls the cell?",
      "What is the role of chlorophyll?",
    ]);
    const quiz = tables.quizQuestions.filter((row) => row.setId === partialId);
    expect(quiz).toHaveLength(2);
    expect(quiz.map((question) => question.question)).toContain(
      "Which gas is released as a product of photosynthesis?",
    );
    const exams = tables.examQuestions.filter((row) => row.setId === partialId);
    expect(exams).toHaveLength(2);
    expect(exams.map((question) => question.question)).toContain(
      "Explain how chlorophyll supports photosynthesis.",
    );
    expect(tables.studySetCache[0]!.uses).toBe(1);
  });

  test("a card checkpoint saves the new deck without touching the old quiz or exams", async () => {
    const tables = rowsForSource("set:source");
    const { ctx } = fakeContext(tables);
    const handler = (completeGeneration as unknown as {
      _handler: (
        ctx: unknown,
        args: Record<string, unknown>,
      ) => Promise<{
        stored: boolean;
        counts?: { cards: number; quiz: number; exams: number };
      }>;
    })._handler;

    const result = await handler(ctx, {
      setId: "set:source",
      summary: {
        title: "Cell structure",
        overview: "Cells contain organelles.",
        keyPoints: ["Cells contain organelles."],
        examFocus: ["Cell structure"],
      },
      cards: [
        {
          front: "What do cells contain?",
          back: "Cells contain organelles.",
        },
      ],
      quiz: [],
      exams: [],
      title: "Cell structure",
      requested: { cards: 3, quiz: 5, exams: 3 },
      final: false,
      cardsOnly: true,
    });

    expect(result.stored).toBe(true);
    expect(result.counts).toEqual({ cards: 1, quiz: 1, exams: 1 });
    const set = tables.studySets[0]!;
    expect(set.status).toBe("processing");
    expect(set.cardCount).toBe(1);
    expect(set.quizCount).toBe(1);
    expect(set.examCount).toBe(1);
    expect(set.knownCount).toBe(0);
    expect(tables.flashcards.filter((row) => row.setId === "set:source")).toHaveLength(1);
    expect(tables.quizQuestions.filter((row) => row.setId === "set:source")).toHaveLength(1);
    expect(tables.examQuestions.filter((row) => row.setId === "set:source")).toHaveLength(1);
  });

  test("a rebuild continuation replaces the old quiz and exams instead of reusing them", async () => {
    const targetId = "set:rebuild";
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    tables.studySets.push(
      sourceSet({
        _id: targetId,
        userId: "user:new",
        title: "Cells rebuilt",
        notes: `${NOTES}\nThe nucleus stores genetic material.`,
        status: "processing",
        processingStartedAt: 1,
        cardCount: 2,
        quizCount: 1,
        examCount: 1,
        targetCardCount: 2,
        targetQuizCount: 1,
        targetExamCount: 1,
        summary: {
          title: "Cells rebuilt",
          overview: "Cells contain organelles.",
          keyPoints: ["Cells contain organelles."],
          examFocus: ["Cell structure"],
        },
      }),
    );
    for (const [index, card] of tables.flashcards.slice(0, 2).entries()) {
      tables.flashcards.push({
        ...card,
        _id: `target-card:${index}`,
        setId: targetId,
        userId: "user:new",
        order: index,
      });
    }
    tables.quizQuestions.push({
      ...tables.quizQuestions[0]!,
      _id: "target-old-quiz",
      setId: targetId,
      userId: "user:new",
      question: "OLD quiz question?",
      options: ["Old A", "Old B", "Old C", "Old D"],
      correctIndex: 0,
      order: 0,
    });
    tables.examQuestions.push({
      ...tables.examQuestions[0]!,
      _id: "target-old-exam",
      setId: targetId,
      userId: "user:new",
      question: "OLD exam question?",
      order: 0,
    });

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      let content: string;
      if (prompt.includes("quiz questions")) {
        content = JSON.stringify({
          questions: [
            {
              question: "What stores genetic material?",
              type: "typed",
              answer: "nucleus",
              acceptedAnswers: ["nucleus"],
              explanation:
                "The nucleus is correct because it stores genetic material; the membrane is wrong because it controls entry and exit.",
            },
          ],
        });
      } else if (prompt.includes("marking guide")) {
        content = JSON.stringify({
          questions: [
            {
              question: "Describe the role of the nucleus.",
              marks: 1,
              modelAnswer: "The nucleus stores genetic material.",
              markingGuide: ["1 mark: stores genetic material"],
            },
          ],
        });
      } else {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const action = actionContext(tables);
      const handler = (continueStudySetQuiz as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
      })._handler;
      await handler(action, {
        setId: targetId,
        userId: "user:new",
        runStartedAt: 1,
        replaceExisting: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    const finished = tables.studySets.find((row) => row._id === targetId)!;
    expect(finished.status).toBe("ready");
    const quiz = tables.quizQuestions.filter((row) => row.setId === targetId);
    expect(quiz).toHaveLength(1);
    expect(quiz[0]!.question).toBe("What stores genetic material?");
    expect(quiz.some((row) => row.question === "OLD quiz question?")).toBe(false);
    const exams = tables.examQuestions.filter((row) => row.setId === targetId);
    expect(exams).toHaveLength(1);
    expect(exams[0]!.question).toBe("Describe the role of the nucleus.");
    expect(exams.some((row) => row.question === "OLD exam question?")).toBe(false);
  });

  test("merges generated topics into a partially reused set", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    const targetId = "set:partial";
    tables.studySets.push({
      ...source,
      _id: targetId,
      userId: "user:new",
      status: "queued",
      summary: undefined,
      generationNotes: `${NOTES}\nTopic: Cell transport`,
      notes: `${NOTES}\nDiffusion moves particles from high to low concentration.`,
      topicId: "cell-structure",
      topicIds: ["cell-structure", "cell-transport"],
      cardCount: 1,
      quizCount: 1,
      examCount: 1,
      targetCardCount: 2,
      targetQuizCount: 1,
      targetExamCount: 1,
    });
    tables.flashcards.push({
      ...tables.flashcards[0]!,
      _id: "card:copied",
      setId: targetId,
      userId: "user:new",
      front: "What do cells contain?",
      back: "Organelles.",
      order: 0,
    });
    tables.quizQuestions.push({
      ...tables.quizQuestions[0]!,
      _id: "quiz:copied",
      setId: targetId,
      userId: "user:new",
      order: 0,
    });
    tables.examQuestions.push({
      ...tables.examQuestions[0]!,
      _id: "exam:copied",
      setId: targetId,
      userId: "user:new",
      order: 0,
    });
    const { ctx } = fakeContext(tables);
    const handler = (completeGeneration as unknown as {
      _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<any>;
    })._handler;

    const result = await handler(ctx, {
      setId: targetId,
      summary: {
        title: "Cell transport",
        overview: "Cells move substances across membranes.",
        keyPoints: ["Diffusion moves particles."],
        examFocus: ["Diffusion"],
      },
      cards: [
        {
          front: "What is diffusion?",
          back: "Diffusion moves particles from high to low concentration.",
        },
      ],
      quiz: [],
      exams: [],
      title: "Cell transport",
      requested: { cards: 2, quiz: 1, exams: 1 },
      final: true,
      keepExisting: true,
    });

    expect(result.stored).toBe(true);
    const copy = tables.studySets.find((row) => row._id === targetId)!;
    expect(copy.status).toBe("ready");
    expect(copy.cardCount).toBe(2);
    expect(copy.quizCount).toBe(1);
    expect(copy.examCount).toBe(1);
    expect(copy.generationNotes).toBeUndefined();
    const cards = tables.flashcards.filter((row) => row.setId === targetId);
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What is diffusion?",
    ]);
    expect(tables.quizQuestions.filter((row) => row.setId === targetId)).toHaveLength(1);
    expect(tables.examQuestions.filter((row) => row.setId === targetId)).toHaveLength(1);
  });

  test("a short card checkpoint backfills only the missing cards", async () => {
    const tables = rowsForSource("set:backfill");
    const set = tables.studySets[0]!;
    set.notes = [
      "Cells contain organelles.",
      "The nucleus stores genetic material.",
      "Mitochondria release energy.",
    ].join(" ");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.cardCount = 1;
    set.quizCount = 0;
    set.examCount = 0;
    set.targetCardCount = 3;
    set.targetQuizCount = 1;
    set.targetExamCount = 1;
    tables.flashcards = [
      {
        ...tables.flashcards[0]!,
        _id: "card:backfill",
        setId: "set:backfill",
        userId: "user:source",
        front: "What do cells contain?",
        back: "Organelles.",
        order: 0,
      },
    ];
    tables.quizQuestions = [];
    tables.examQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    let requestedCards = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      const request = /Create (\d+) revision flashcards/.exec(prompt);
      if (!request) {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      requestedCards = Number(request[1]);
      const content = JSON.stringify({
        cards: [
          {
            front: "What does the nucleus store?",
            back: "The nucleus stores genetic material.",
            keyPoint: "The nucleus stores genetic material.",
          },
          {
            front: "What do mitochondria release?",
            back: "Mitochondria release energy.",
            keyPoint: "Mitochondria release energy.",
          },
        ],
      });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    let scheduled: ReturnType<typeof actionContext>["scheduled"] = [];
    try {
      const action = actionContext(tables, { captureSchedule: true });
      scheduled = action.scheduled;
      const handler = (continueStudySetCards as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<any>;
      })._handler;
      const result = await handler(action, {
        setId: "set:backfill",
        userId: "user:source",
        runStartedAt: 1,
      });

      expect(result.continued).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    expect(requestedCards).toBe(2);
    const cards = tables.flashcards.filter((row) => row.setId === "set:backfill");
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What does the nucleus store?",
      "What do mitochondria release?",
    ]);
    // A normal stage hand-off is not a retry, so it does not spend one of the
    // three automatic attempts.
    expect(set.autoRetryCount).toBeUndefined();
    expect(set.progress).toBe("Flashcards saved. Continuing with the quiz…");
    expect(
      scheduled.some(({ name }) => name === "ai:continueStudySetQuiz"),
    ).toBe(true);
  });

  test("saves each card batch before asking for the next one", async () => {
    const tables = rowsForSource("set:incremental");
    const set = tables.studySets[0]!;
    set.notes = [
      "Cells contain organelles.",
      "The nucleus stores genetic material.",
      "Mitochondria release energy.",
    ].join(" ");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.cardCount = 1;
    set.quizCount = 0;
    set.examCount = 0;
    set.targetCardCount = 3;
    set.targetQuizCount = 1;
    set.targetExamCount = 1;
    tables.flashcards = [
      {
        ...tables.flashcards[0]!,
        _id: "card:incremental",
        setId: "set:incremental",
        userId: "user:source",
        front: "What do cells contain?",
        back: "Organelles.",
        order: 0,
      },
    ];
    tables.quizQuestions = [];
    tables.examQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    let cardCalls = 0;
    let cardsVisibleOnSecondRequest = -1;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      if (prompt.includes("<candidate_flashcards>")) return cardReviewResponse(prompt);
      if (!/Create \d+ revision flashcards/.test(prompt)) {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      cardCalls += 1;
      if (cardCalls > 1) {
        // The first batch has been shown as built. It must already be in the
        // database before this second request is allowed to start.
        cardsVisibleOnSecondRequest = tables.flashcards.filter(
          (row) => row.setId === "set:incremental",
        ).length;
        throw new Error("gateway stopped mid-build");
      }
      const content = JSON.stringify({
        cards: [
          {
            front: "What does the nucleus store?",
            back: "The nucleus stores genetic material.",
            keyPoint: "The nucleus stores genetic material.",
          },
        ],
      });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const action = actionContext(tables, { captureSchedule: true });
      const handler = (continueStudySetCards as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<any>;
      })._handler;
      const result = await handler(action, {
        setId: "set:incremental",
        userId: "user:source",
        runStartedAt: 1,
      });

      expect(result.continued).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    expect(cardCalls).toBeGreaterThan(1);
    expect(cardsVisibleOnSecondRequest).toBe(2);
    const cards = tables.flashcards.filter((row) => row.setId === "set:incremental");
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What does the nucleus store?",
    ]);
    expect(set.cardCount).toBe(2);
  });

  test("drops a card the fact-checker calls wrong before saving it", async () => {
    const tables = rowsForSource("set:fact-check");
    const set = tables.studySets[0]!;
    set.notes = [
      "Scrooge is a miser who refuses to spend money on Christmas.",
      "Bob Cratchit is Scrooge's clerk.",
      "The Ghost of Christmas Present shows Scrooge the Cratchit family.",
      "At the end Scrooge will send the Cratchits a turkey.",
    ].join(" ");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.cardCount = 0;
    set.quizCount = 0;
    set.examCount = 0;
    set.targetCardCount = 2;
    set.targetQuizCount = 0;
    set.targetExamCount = 0;
    set.courseId = undefined;
    set.topicId = undefined;
    set.topicIds = undefined;
    tables.flashcards = [];
    tables.quizQuestions = [];
    tables.examQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    let cardCalls = 0;
    const reviewPrompts: string[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      if (prompt.includes("<candidate_flashcards>")) {
        reviewPrompts.push(prompt);
        const verdicts = Array.from(prompt.matchAll(/^\d+\. Q: (.+)$/gm)).map(
          (match, index) => ({
            card: index + 1,
            verdict: match[1]!.includes("Ghost of Christmas Present")
              ? "wrong"
              : "keep",
            reason: match[1]!.includes("Ghost of Christmas Present")
              ? "The extract says the Ghost shows the Cratchit family; the turkey comes at the end."
              : "",
          }),
        );
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ verdicts }) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (!/Create \d+ revision flashcards/.test(prompt)) {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      cardCalls += 1;
      const cards =
        cardCalls === 1
          ? [
              {
                front: "Who is Scrooge's clerk?",
                back: "Bob Cratchit.",
                keyPoint: "Scrooge's clerk is Bob Cratchit.",
              },
              {
                front: "What does the Ghost of Christmas Present show Scrooge?",
                back: "A turkey.",
                keyPoint: "The Ghost of Christmas Present shows Scrooge a turkey.",
              },
            ]
          : [
              {
                front: "What does Scrooge send the Cratchits?",
                back: "A turkey.",
                keyPoint: "Scrooge sends the Cratchits a turkey.",
              },
            ];
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ cards }) } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const action = actionContext(tables, { captureSchedule: true });
      const handler = (continueStudySetCards as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<any>;
      })._handler;
      await handler(action, {
        setId: "set:fact-check",
        userId: "user:source",
        runStartedAt: 1,
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    // The reviewer saw the material and the batch, and its wrong verdict kept
    // the misattributed card out of the deck while the next batch filled the
    // count.
    expect(cardCalls).toBeGreaterThan(1);
    expect(reviewPrompts[0]).toContain("Ghost of Christmas Present");
    expect(reviewPrompts[0]).toContain("Scrooge is a miser");
    const fronts = tables.flashcards
      .filter((row) => row.setId === "set:fact-check")
      .map((row) => row.front);
    expect(fronts).toEqual([
      "Who is Scrooge's clerk?",
      "What does Scrooge send the Cratchits?",
    ]);
  });

  test("a pathway build writes cards for every section, not just the first", async () => {
    const tables = rowsForSource("set:pathway-cards");
    const set = tables.studySets[0]!;
    set.notes = [
      "Course: GCSE Chemistry",
      "Exam board: AQA",
      "Syllabus scope for this set:",
      "",
      "Section 1: Atomic structure",
      "Unit: Atomic structure",
      "Atoms contain protons, neutrons and electrons.",
      "Covers:",
      "- Relative atomic mass",
      "",
      "Section 2: Bonding",
      "Unit: Bonding",
      "Ionic compounds form between metals and non-metals.",
      "Covers:",
      "- Ionic and covalent bonds",
      "",
      "Section 3: Quantitative chemistry",
      "Unit: Quantitative chemistry",
      "The mole measures the amount of substance.",
      "Covers:",
      "- Conservation of mass",
    ].join("\n");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.cardCount = 0;
    set.quizCount = 0;
    set.examCount = 0;
    set.targetCardCount = 3;
    set.targetQuizCount = 1;
    set.targetExamCount = 0;
    tables.flashcards = [];
    tables.quizQuestions = [];
    tables.examQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    const prompts: string[] = [];
    const facts: Record<string, { front: string; back: string }> = {
      "Atomic structure": {
        front: "What do atoms contain?",
        back: "Protons, neutrons and electrons.",
      },
      Bonding: {
        front: "What do ionic compounds form between?",
        back: "Metals and non-metals.",
      },
      "Quantitative chemistry": {
        front: "What does the mole measure?",
        back: "The amount of substance.",
      },
    };
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      if (prompt.includes("<candidate_flashcards>")) return cardReviewResponse(prompt);
      if (!/Create \d+ revision flashcards/.test(prompt)) {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      prompts.push(prompt);
      const section = /only the section "([^"]+)"/.exec(prompt)?.[1] ?? "";
      const fact = facts[section];
      if (!fact) throw new Error(`Card request did not name its section: ${section}`);
      const content = JSON.stringify({
        cards: [{ ...fact, keyPoint: fact.back }],
      });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const action = actionContext(tables);
      const handler = (continueStudySetCards as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
      })._handler;
      await handler(action, {
        setId: "set:pathway-cards",
        userId: "user:source",
        runStartedAt: 1,
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    // One request per section, each scoped to that section alone. A single
    // whole-brief prompt was clipped and wrote cards for the early topics only.
    expect(prompts).toHaveLength(3);
    for (const [section, prompt] of [
      ["Atomic structure", prompts[0]!],
      ["Bonding", prompts[1]!],
      ["Quantitative chemistry", prompts[2]!],
    ] as const) {
      expect(prompt).toContain(section);
      for (const other of Object.keys(facts)) {
        if (other !== section) expect(prompt).not.toContain(other);
      }
    }
    const cards = tables.flashcards.filter((row) => row.setId === "set:pathway-cards");
    expect(cards.map((card) => card.front).sort()).toEqual(
      Object.values(facts)
        .map((fact) => fact.front)
        .sort(),
    );
    expect(set.cardCount).toBe(3);
  });

  test("a long continuation builds cards, quiz and exams in parallel", async () => {
    const tables = rowsForSource("set:parallel");
    const set = tables.studySets[0]!;
    const relays = [
      ["alpha", "cobalt", "blue sensor"],
      ["beta", "nickel", "red valve"],
      ["gamma", "copper", "green pump"],
      ["delta", "zinc", "amber gauge"],
      ["epsilon", "silver", "violet filter"],
      ["zeta", "tin", "orange coil"],
      ["eta", "iron", "white rotor"],
      ["theta", "lead", "black shield"],
      ["iota", "gold", "yellow wire"],
      ["kappa", "argon", "grey tank"],
      ["lambda", "neon", "pink lens"],
      ["mu", "helium", "brown seal"],
      ["nu", "xenon", "purple probe"],
      ["xi", "radon", "silver spring"],
      ["omicron", "krypton", "teal clamp"],
      ["pi", "boron", "olive belt"],
      ["rho", "carbon", "navy plate"],
      ["sigma", "sulfur", "lime fuse"],
      ["tau", "chlorine", "coral switch"],
      ["upsilon", "fluorine", "indigo dial"],
      ["phi", "bromine", "maroon cap"],
    ] as const;
    set.notes = [
      ...relays.map(
        ([relay, metal, context]) =>
          `The ${relay} relay uses ${metal} while calibrating the ${context}.`,
      ),
      "The nucleus stores genetic material and controls entry to the cell.",
      "Mitochondria release energy during aerobic respiration.",
    ].join(" ");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.cardCount = 1;
    set.quizCount = 0;
    set.examCount = 0;
    set.targetCardCount = relays.length + 1;
    set.targetQuizCount = 1;
    set.targetExamCount = 1;
    // Exercise the non-pathway generators in this test; pathway generation has
    // its own section batching and is covered separately.
    set.courseId = undefined;
    set.topicId = undefined;
    set.topicIds = undefined;
    tables.flashcards = [
      {
        ...tables.flashcards[0]!,
        _id: "card:parallel",
        setId: "set:parallel",
        userId: "user:source",
        front: "What do cells contain?",
        back: "Organelles.",
        order: 0,
      },
    ];
    tables.quizQuestions = [];
    tables.examQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    let inFlight = 0;
    let maxInFlight = 0;
    const prompts: string[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          messages?: Array<{ content?: string }>;
        };
        const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
        prompts.push(prompt);
        if (prompt.includes("<candidate_flashcards>")) return cardReviewResponse(prompt);
        await new Promise((resolve) => setTimeout(resolve, 10));
        let content: string;
        if (prompt.includes("Create ") && prompt.includes("revision flashcards")) {
          const cards = relays.map(([relay, metal, context]) => ({
            front: `Which metal does the ${relay} relay use while calibrating the ${context}?`,
            back: `${metal[0]!.toUpperCase()}${metal.slice(1)} while calibrating the ${context}.`,
            keyPoint: `The ${relay} relay uses ${metal} while calibrating the ${context}.`,
          }));
          content = JSON.stringify({ cards });
        } else if (prompt.includes("quiz questions")) {
          content = JSON.stringify({
            questions: [
              {
                question: "What stores genetic material?",
                type: "typed",
                answer: "nucleus",
                acceptedAnswers: ["nucleus"],
                explanation:
                  "The nucleus is correct because it stores genetic material; the membrane is wrong because it controls entry and exit.",
              },
              {
                question: "Which organelle releases energy?",
                type: "typed",
                answer: "mitochondria",
                acceptedAnswers: ["mitochondrion", "the mitochondria"],
                explanation:
                  "Mitochondria are correct because they release energy; the cytoplasm is wrong because it is the site of glycolysis.",
              },
            ],
          });
        } else if (prompt.includes("marking guide")) {
          content = JSON.stringify({
            questions: [
              {
                question: "Describe the role of the nucleus.",
                marks: 1,
                modelAnswer: "The nucleus stores genetic material.",
                markingGuide: ["1 mark: stores genetic material"],
              },
            ],
          });
        } else {
          throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
        }
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } finally {
        inFlight -= 1;
      }
    }) as typeof fetch;

    try {
      const action = actionContext(tables, { captureSchedule: true });
      const handler = (continueStudySetCards as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<any>;
      })._handler;
      await handler(action, {
        setId: "set:parallel",
        userId: "user:source",
        runStartedAt: 1,
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    expect(maxInFlight).toBeGreaterThan(1);
    expect(prompts.some((prompt) => prompt.includes("revision flashcards"))).toBe(true);
    expect(prompts.some((prompt) => prompt.includes("quiz questions"))).toBe(true);
    expect(prompts.some((prompt) => prompt.includes("marking guide"))).toBe(true);
    expect(tables.quizQuestions.filter((row) => row.setId === "set:parallel")).toHaveLength(1);
    expect(tables.examQuestions.filter((row) => row.setId === "set:parallel")).toHaveLength(1);
    expect(set.cardCount).toBeGreaterThanOrEqual(1);
  });

  test("saves each quiz batch before asking for the next one", async () => {
    const tables = rowsForSource("set:quiz-checkpoint");
    const set = tables.studySets[0]!;
    set.notes = [
      "Cells contain organelles.",
      "The nucleus stores genetic material.",
      "Mitochondria release energy.",
      "Ribosomes build proteins.",
      "The cell membrane controls entry and exit.",
      "Chloroplasts absorb light energy during photosynthesis.",
    ].join(" ");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.cardCount = tables.flashcards.length;
    set.quizCount = 0;
    set.examCount = 0;
    set.targetCardCount = set.cardCount;
    set.targetQuizCount = 3;
    set.targetExamCount = 1;
    set.courseId = undefined;
    set.topicId = undefined;
    set.topicIds = undefined;
    tables.quizQuestions = [];
    tables.examQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    let quizCalls = 0;
    let quizRowsSeenOnSecondRequest = -1;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      let content: string;
      if (prompt.includes("quiz questions")) {
        quizCalls += 1;
        const questions = [
          {
            question: "What stores genetic material?",
            type: "typed",
            answer: "nucleus",
            acceptedAnswers: ["the nucleus"],
            explanation:
              "The nucleus is correct because it stores genetic material; the membrane is wrong because it controls entry.",
          },
          {
            question: "Which organelle releases energy?",
            type: "typed",
            answer: "mitochondria",
            acceptedAnswers: ["mitochondrion", "the mitochondria"],
            explanation:
              "Mitochondria are correct because they release energy; the cytoplasm is wrong because it is the site of glycolysis.",
          },
          {
            question: "What do ribosomes build?",
            type: "typed",
            answer: "proteins",
            acceptedAnswers: ["protein"],
            explanation:
              "Ribosomes are correct because they build proteins; the membrane is wrong because it controls entry.",
          },
        ];
        if (quizCalls > 1) {
          // The first two questions were reported as built. They must already
          // be in the database before this request is allowed to start.
          quizRowsSeenOnSecondRequest = tables.quizQuestions.filter(
            (row) => row.setId === "set:quiz-checkpoint",
          ).length;
          content = JSON.stringify({ questions: [questions[2]] });
        } else {
          content = JSON.stringify({ questions: questions.slice(0, 2) });
        }
      } else if (prompt.includes("marking guide")) {
        content = JSON.stringify({
          questions: [
            {
              question: "Describe the role of the nucleus.",
              marks: 1,
              modelAnswer: "The nucleus stores genetic material.",
              markingGuide: ["1 mark: stores genetic material"],
            },
          ],
        });
      } else {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const action = actionContext(tables);
      const handler = (continueStudySetQuiz as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
      })._handler;
      await handler(action, {
        setId: "set:quiz-checkpoint",
        userId: "user:source",
        runStartedAt: 1,
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    expect(quizCalls).toBeGreaterThan(1);
    expect(quizRowsSeenOnSecondRequest).toBe(2);
    const quiz = tables.quizQuestions.filter((row) => row.setId === "set:quiz-checkpoint");
    expect(quiz).toHaveLength(3);
  });

  test("saves each exam batch before asking for the next one", async () => {
    const tables = rowsForSource("set:exam-checkpoint");
    const set = tables.studySets[0]!;
    set.notes = [
      "Cells contain organelles that carry out specific jobs inside the cell.",
      "The nucleus stores genetic material and controls the activities of the cell.",
      "Mitochondria release energy during aerobic respiration in the cytoplasm.",
      "Ribosomes build proteins by joining amino acids in the correct order.",
      "The cell membrane controls which substances enter and leave the cell.",
      "Chloroplasts absorb light energy for photosynthesis in plant cells.",
    ].join(" ");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.cardCount = tables.flashcards.length;
    set.quizCount = 0;
    set.examCount = 0;
    set.targetCardCount = set.cardCount;
    set.targetQuizCount = 1;
    set.targetExamCount = 3;
    set.courseId = undefined;
    set.topicId = undefined;
    set.topicIds = undefined;
    tables.quizQuestions = [];
    tables.examQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    let examCalls = 0;
    let examRowsSeenOnSecondRequest = -1;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      if (!prompt.includes("marking guide")) {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      examCalls += 1;
      const questions = [
        {
          question: "Describe the role of the nucleus.",
          marks: 1,
          modelAnswer: "The nucleus stores genetic material.",
          markingGuide: ["1 mark: stores genetic material"],
        },
        {
          question: "What do mitochondria release?",
          marks: 1,
          modelAnswer: "Mitochondria release energy.",
          markingGuide: ["1 mark: release energy"],
        },
        {
          question: "What do ribosomes build?",
          marks: 1,
          modelAnswer: "Ribosomes build proteins.",
          markingGuide: ["1 mark: build proteins"],
        },
      ];
      if (examCalls > 1) {
        // The first two questions were reported as built. They must already be
        // in the database before this request is allowed to start.
        examRowsSeenOnSecondRequest = tables.examQuestions.filter(
          (row) => row.setId === "set:exam-checkpoint",
        ).length;
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: examCalls > 1 ? [questions[2]] : questions.slice(0, 2),
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const action = actionContext(tables);
      const handler = (continueStudySetExams as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
      })._handler;
      await handler(action, {
        setId: "set:exam-checkpoint",
        userId: "user:source",
        runStartedAt: 1,
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    expect(examCalls).toBeGreaterThan(1);
    expect(examRowsSeenOnSecondRequest).toBe(2);
    const exams = tables.examQuestions.filter((row) => row.setId === "set:exam-checkpoint");
    expect(exams).toHaveLength(3);
  });

  test("keeps a checkpointed quiz batch when a later generation step fails", async () => {
    const tables = rowsForSource("set:quiz-checkpoint-failure");
    const set = tables.studySets[0]!;
    set.notes = [
      "Cells contain organelles.",
      "The nucleus stores genetic material.",
      "Mitochondria release energy.",
      "Ribosomes build proteins.",
      "The cell membrane controls entry and exit.",
      "Chloroplasts absorb light energy during photosynthesis.",
    ].join(" ");
    set.status = "processing";
    set.processingStartedAt = 1;
    set.cardCount = tables.flashcards.length;
    set.quizCount = 0;
    set.examCount = 1;
    set.targetCardCount = set.cardCount;
    set.targetQuizCount = 3;
    set.targetExamCount = 1;
    set.courseId = undefined;
    set.topicId = undefined;
    set.topicIds = undefined;
    tables.quizQuestions = [];

    const originalFetch = globalThis.fetch;
    const originalKey = process.env.NVIDIA_API_KEY;
    const originalGateway = process.env.RESPAN_GATEWAY_URL;
    process.env.NVIDIA_API_KEY = "test-nvidia-key";
    delete process.env.RESPAN_GATEWAY_URL;
    let quizCalls = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content ?? "").join("\n") ?? "";
      if (!prompt.includes("quiz questions")) {
        throw new Error(`Unexpected AI request: ${prompt.slice(0, 120)}`);
      }
      quizCalls += 1;
      const questions = [
        {
          question: "What stores genetic material?",
          type: "typed",
          answer: "nucleus",
          acceptedAnswers: ["the nucleus"],
          explanation:
            "The nucleus is correct because it stores genetic material; the membrane is wrong because it controls entry.",
        },
        {
          question: "Which organelle releases energy?",
          type: "typed",
          answer: "mitochondria",
          acceptedAnswers: ["mitochondrion", "the mitochondria"],
          explanation:
            "Mitochondria are correct because they release energy; the cytoplasm is wrong because it is the site of glycolysis.",
        },
        {
          question: "What do ribosomes build?",
          type: "typed",
          answer: "proteins",
          acceptedAnswers: ["protein"],
          explanation:
            "Ribosomes are correct because they build proteins; the membrane is wrong because it controls entry.",
        },
      ];
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: quizCalls > 1 ? [questions[2]] : questions.slice(0, 2),
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    let quizCheckpoints = 0;
    try {
      const action = actionContext(tables, { captureSchedule: true });
      const runMutation = action.runMutation;
      action.runMutation = async (ref, args) => {
        if (
          functionNameOf(ref) === "studySets:completeGeneration" &&
          args.quizOnly === true &&
          args.final === false
        ) {
          quizCheckpoints += 1;
          // The first batch is already durable. Fail the next checkpoint to
          // simulate the generation stage stopping before the final save.
          if (quizCheckpoints === 2) {
            throw new Error("simulated later generation failure");
          }
        }
        return runMutation(ref, args);
      };
      const handler = (continueStudySetQuiz as unknown as {
        _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
      })._handler;
      await handler(action, {
        setId: "set:quiz-checkpoint-failure",
        userId: "user:source",
        runStartedAt: 1,
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = originalKey;
      if (originalGateway === undefined) delete process.env.RESPAN_GATEWAY_URL;
      else process.env.RESPAN_GATEWAY_URL = originalGateway;
    }

    expect(quizCalls).toBeGreaterThan(1);
    expect(quizCheckpoints).toBeGreaterThanOrEqual(3);
    const quiz = tables.quizQuestions.filter(
      (row) => row.setId === "set:quiz-checkpoint-failure",
    );
    expect(quiz.map((row) => row.question)).toEqual([
      "What stores genetic material?",
      "Which organelle releases energy?",
    ]);
  });

  test("a background retry starts a new run token and stops at the cap", async () => {
    const tables = rowsForSource("set:retry-token");
    const set = tables.studySets[0]!;
    set.status = "ready";
    set.processingStartedAt = 10;
    const { ctx } = fakeContext(tables);
    const handler = (claimBackgroundRetry as unknown as {
      _handler: (
        ctx: unknown,
        args: { setId: string },
      ) => Promise<{ allowed: boolean; attempt: number; runStartedAt: number }>;
    })._handler;

    let previousToken = set.processingStartedAt!;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const retry = await handler(ctx, { setId: "set:retry-token" });
      expect(retry.allowed).toBe(true);
      expect(retry.attempt).toBe(attempt);
      expect(retry.runStartedAt).toBeGreaterThan(previousToken);
      expect(set.status).toBe("processing");
      expect(set.processingStartedAt).toBe(retry.runStartedAt);
      previousToken = retry.runStartedAt;
    }

    expect(await handler(ctx, { setId: "set:retry-token" })).toEqual({
      allowed: false,
      attempt: 3,
      runStartedAt: 0,
    });
  });

  test("a duplicate continuation with the same run token is rejected", async () => {
    const tables = rowsForSource("set:continuation");
    tables.studySets[0]!.status = "processing";
    tables.studySets[0]!.processingStartedAt = 100;
    const { ctx } = fakeContext(tables);
    const handler = (claimContinuation as unknown as {
      _handler: (
        ctx: unknown,
        args: { setId: string; runStartedAt: number },
      ) => Promise<{ claimed: boolean; startedAt: number }>;
    })._handler;

    const first = await handler(ctx, {
      setId: "set:continuation",
      runStartedAt: 100,
    });
    const duplicate = await handler(ctx, {
      setId: "set:continuation",
      runStartedAt: 100,
    });

    expect(first.claimed).toBe(true);
    expect(duplicate).toEqual({ claimed: false, startedAt: 0 });
    expect(tables.studySets[0]!.processingStartedAt).toBe(first.startedAt);
  });

  test("the stale-build watchdog resumes a matching run and ignores an old one", async () => {
    const tables = rowsForSource("set:watchdog");
    const set = tables.studySets[0]!;
    set.status = "processing";
    set.processingStartedAt = 777;
    set.cardCount = 1;

    const action = actionContext(tables, { captureSchedule: true });
    const handler = (resumeStaleStudySet as unknown as {
      _handler: (
        ctx: unknown,
        args: { setId: string; userId: string; runStartedAt: number },
      ) => Promise<{ resumed: boolean; stopped?: boolean; attempt?: number }>;
    })._handler;

    expect(
      await handler(action, {
        setId: "set:watchdog",
        userId: "user:source",
        runStartedAt: 776,
      }),
    ).toEqual({ resumed: false });
    expect(action.scheduled).toHaveLength(0);
    expect(set.autoRetryCount).toBeUndefined();

    expect(
      await handler(action, {
        setId: "set:watchdog",
        userId: "user:source",
        runStartedAt: 777,
      }),
    ).toEqual({ resumed: true, attempt: 1 });
    expect(set.autoRetryCount).toBe(1);
    expect(action.scheduled).toHaveLength(1);
    expect(action.scheduled[0]).toMatchObject({
      delay: 0,
      name: "ai:continueStudySetCards",
      args: { setId: "set:watchdog", userId: "user:source" },
    });
    expect(action.scheduled[0]!.args.runStartedAt).toBeGreaterThan(777);
  });
});
