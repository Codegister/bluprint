import { beforeEach, describe, expect, test } from "bun:test";

import {
  clearCardRun,
  clearQuizRun,
  readCardRun,
  readExamRun,
  readQuizRun,
  saveCardRun,
  saveExamRun,
  saveQuizRun,
} from "../src/lib/studySession";

/** Minimal localStorage stand-in: the module only needs these four methods. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } as Storage;
}

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
});

const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<1 | 2 | 3 | 4, number>;

describe("resuming a card run", () => {
  test("the position and the ratings so far come back", () => {
    saveCardRun("set-1", {
      queueIds: ["a", "b", "c"],
      index: 2,
      counts: { ...counts, 3: 2 },
      finished: false,
    });

    const run = readCardRun("set-1", ["a", "b", "c"]);
    expect(run?.index).toBe(2);
    expect(run?.queueIds).toEqual(["a", "b", "c"]);
    expect(run?.counts[3]).toBe(2);
    expect(run?.finished).toBe(false);
  });

  test("cards already reviewed and gone from the list do not restart the run", () => {
    // The student rated a and b; those cards have left the due list, so only
    // c and d are still handed to the component.
    saveCardRun("set-1", {
      queueIds: ["a", "b", "c", "d"],
      index: 2,
      counts: { ...counts, 2: 2 },
      finished: false,
    });

    const run = readCardRun("set-1", ["c", "d"]);
    expect(run?.queueIds).toEqual(["c", "d"]);
    expect(run?.index).toBe(0);
    expect(run?.counts[2]).toBe(2);
  });

  test("a run whose cards are all gone is not resumed", () => {
    saveCardRun("set-1", {
      queueIds: ["a", "b"],
      index: 1,
      counts,
      finished: false,
    });
    expect(readCardRun("set-1", [])).toBeNull();
  });

  test("finished is only trusted when the run really ended at the last card", () => {
    saveCardRun("set-1", {
      queueIds: ["a", "b", "c"],
      index: 2,
      counts,
      finished: true,
    });
    expect(readCardRun("set-1", ["c"])?.finished).toBe(true);

    saveCardRun("set-1", {
      queueIds: ["a", "b", "c"],
      index: 0,
      counts,
      finished: true,
    });
    expect(readCardRun("set-1", ["a", "b", "c"])?.finished).toBe(false);
  });

  test("a different set's run is not read", () => {
    saveCardRun("set-1", { queueIds: ["a"], index: 0, counts, finished: false });
    expect(readCardRun("set-2", ["a"])).toBeNull();
  });

  test("clearing forgets the run", () => {
    saveCardRun("set-1", { queueIds: ["a"], index: 0, counts, finished: false });
    clearCardRun("set-1");
    expect(readCardRun("set-1", ["a"])).toBeNull();
  });
});

describe("resuming a quiz run", () => {
  const questionIds = ["q1", "q2", "q3"];

  test("the question, the answers given and the score come back", () => {
    saveQuizRun("set-1", {
      index: 2,
      responses: [{ questionId: "q1", selectedIndex: 1 }, null, null],
      selected: null,
      typed: "half an answer",
      checked: false,
      feedback: null,
      result: null,
    });

    const run = readQuizRun("set-1", questionIds);
    expect(run?.index).toBe(2);
    expect(run?.responses[0]).toEqual({ questionId: "q1", selectedIndex: 1 });
    expect(run?.responses[1]).toBeNull();
    expect(run?.typed).toBe("half an answer");
  });

  test("a checked answer keeps its feedback", () => {
    saveQuizRun("set-1", {
      index: 1,
      responses: [{ questionId: "q1", text: "answer" }],
      selected: null,
      typed: "answer",
      checked: true,
      feedback: { correct: false, expected: "model answer" },
      result: null,
    });

    const run = readQuizRun("set-1", questionIds);
    expect(run?.checked).toBe(true);
    expect(run?.feedback?.expected).toBe("model answer");
  });

  test("a submitted score is kept for the result screen", () => {
    saveQuizRun("set-1", {
      index: 2,
      responses: [],
      selected: null,
      typed: "",
      checked: true,
      feedback: null,
      result: { score: 2, total: 3 },
    });
    expect(readQuizRun("set-1", questionIds)?.result?.score).toBe(2);
  });

  test("a run is dropped when the questions are not the same ones", () => {
    saveQuizRun("set-1", {
      index: 1,
      responses: [{ questionId: "old-1", selectedIndex: 0 }],
      selected: null,
      typed: "",
      checked: false,
      feedback: null,
      result: null,
    });
    expect(readQuizRun("set-1", questionIds)).toBeNull();
  });

  test("a score for a different quiz is not shown", () => {
    saveQuizRun("set-1", {
      index: 1,
      responses: [],
      selected: null,
      typed: "",
      checked: false,
      feedback: null,
      result: { score: 5, total: 10 },
    });
    expect(readQuizRun("set-1", questionIds)).toBeNull();
  });

  test("clearing forgets the run", () => {
    saveQuizRun("set-1", {
      index: 1,
      responses: [],
      selected: null,
      typed: "",
      checked: false,
      feedback: null,
      result: null,
    });
    clearQuizRun("set-1");
    expect(readQuizRun("set-1", questionIds)).toBeNull();
  });
});

describe("resuming exam answers", () => {
  test("typed answers come back, unknown questions are ignored", () => {
    saveExamRun("set-1", {
      answers: { e1: "my first answer", gone: "stale" },
    });
    const run = readExamRun("set-1", ["e1", "e2"]);
    expect(run?.answers).toEqual({ e1: "my first answer" });
  });

  test("nothing typed means nothing to resume", () => {
    saveExamRun("set-1", { answers: { gone: "stale" } });
    expect(readExamRun("set-1", ["e1"])).toBeNull();
  });
});

describe("expiry", () => {
  test("a run older than a week is ignored", () => {
    const store = (globalThis as { window: { localStorage: Storage } }).window
      .localStorage;
    const stale = Date.now() - 8 * 24 * 60 * 60 * 1000;
    store.setItem(
      "bluprint:run:cards:set-1",
      JSON.stringify({
        savedAt: stale,
        state: { queueIds: ["a"], index: 0, counts, finished: false },
      }),
    );
    expect(readCardRun("set-1", ["a"])).toBeNull();
  });

  test("a corrupt entry is ignored rather than throwing", () => {
    const store = (globalThis as { window: { localStorage: Storage } }).window
      .localStorage;
    store.setItem("bluprint:run:quiz:set-1", "{not json");
    expect(readQuizRun("set-1", ["q1"])).toBeNull();
  });
});
