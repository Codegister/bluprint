/**
 * Transient failures are worth another attempt; validation, allowances and
 * missing records are not. Keep that distinction in one place so every screen
 * retries the same class of failure without turning real answers into loops.
 */
export function isTransientFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /failed to fetch|networkerror|network error|fetch failed|timeout|timed out|temporar|rate.?limit|too many requests|\b(408|425|429|500|502|503|504)\b|connection (?:lost|closed)|socket/i.test(
    error.message,
  );
}

/**
 * Run an action again once or twice when the failure is a network/API hiccup.
 * The UI calls this for operations that are safe to repeat; callers still get
 * the final error so an impossible action can be named immediately.
 */
export async function retryTransient<T>(
  run: () => Promise<T>,
  { attempts = 2, delayMs = 700 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientFailure(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
