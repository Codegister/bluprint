import { describe, expect, test } from "bun:test";
import { isTransientFailure, retryTransient } from "../src/lib/retry";

describe("transient action retries", () => {
  test("recognises network and rate-limit failures", () => {
    expect(isTransientFailure(new Error("Failed to fetch"))).toBe(true);
    expect(isTransientFailure(new Error("HTTP 503"))).toBe(true);
    expect(isTransientFailure(new Error("Too many requests"))).toBe(true);
  });

  test("does not retry an impossible request", () => {
    expect(isTransientFailure(new Error("Set up a course first"))).toBe(false);
    expect(isTransientFailure(new Error("You have reached the build limit"))).toBe(false);
    expect(isTransientFailure(new Error("Course not found"))).toBe(false);
  });

  test("runs again after a transient failure and returns the result", async () => {
    let attempts = 0;
    const result = await retryTransient(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("fetch failed");
        return "built";
      },
      { attempts: 3, delayMs: 0 },
    );

    expect(result).toBe("built");
    expect(attempts).toBe(3);
  });

  test("stops immediately when the failure is not transient", async () => {
    let attempts = 0;
    let message = "";
    try {
      await retryTransient(
        async () => {
          attempts += 1;
          throw new Error("This item does not belong to you");
        },
        { attempts: 3, delayMs: 0 },
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(attempts).toBe(1);
    expect(message).toBe("This item does not belong to you");
  });

  test("surfaces the final error once attempts are exhausted", async () => {
    let attempts = 0;
    let message = "";
    try {
      await retryTransient(
        async () => {
          attempts += 1;
          throw new Error("Failed to fetch");
        },
        { attempts: 2, delayMs: 0 },
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(attempts).toBe(2);
    expect(message).toBe("Failed to fetch");
  });
});
