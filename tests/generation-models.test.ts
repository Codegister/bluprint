import { describe, expect, test } from "bun:test";

import {
  StudySetShortfallError,
  isRetryableBuildError,
} from "../src/convex/lib/buildFailure";
import { generationModelChain } from "../src/convex/lib/nvidiaConfig";

describe("generation model routing", () => {
  test("uses a fast writer for the summary and deck and a larger writer for retrieval", () => {
    expect(generationModelChain("summary")[0]).toBe(
      "nvidia/nemotron-3.5-bolt-e4b",
    );
    expect(generationModelChain("cards")[0]).toBe(
      "nvidia/nemotron-3.5-lightning-30b-a3b",
    );
    expect(generationModelChain("quiz")[0]).toBe(
      "nvidia/nemotron-3.5-super-vl-120b-a12b",
    );
    expect(generationModelChain("exam")[0]).toBe(
      "nvidia/nemotron-3.5-super-vl-120b-a12b",
    );
  });

  test("keeps a checked fallback and never routes bulk work to the slow Ultra endpoint", () => {
    for (const task of ["summary", "cards", "quiz", "exam"] as const) {
      const chain = generationModelChain(task);
      expect(chain.length).toBeGreaterThan(1);
      expect(new Set(chain).size).toBe(chain.length);
      expect(chain).not.toContain("nvidia/nemotron-3-ultra-550b-a55b");
    }
  });
});

describe("build retry classification", () => {
  test("retries a shortfall, a rate limit, a server error or a timeout", () => {
    expect(
      isRetryableBuildError(
        new StudySetShortfallError("quiz", 80, 100, {
          cards: 20,
          quiz: 80,
          exams: 0,
        }),
      ),
    ).toBe(true);
    expect(isRetryableBuildError({ status: 429 })).toBe(true);
    expect(isRetryableBuildError({ status: 503 })).toBe(true);
    expect(isRetryableBuildError({ status: 0 })).toBe(true);
    expect(isRetryableBuildError(new Error("The operation timed out"))).toBe(
      true,
    );
  });

  test("does not retry a rejected key or a model that is not installed", () => {
    expect(isRetryableBuildError({ status: 401 })).toBe(false);
    expect(isRetryableBuildError({ status: 403 })).toBe(false);
    expect(isRetryableBuildError({ status: 404 })).toBe(false);
    expect(isRetryableBuildError({ status: 410 })).toBe(false);
  });
});
