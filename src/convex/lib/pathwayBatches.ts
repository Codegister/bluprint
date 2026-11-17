/**
 * Runs section-scoped generation for a long pathway.
 *
 * The quiz and exam generators both need the same behaviour: a bounded number
 * of parallel calls, a shared deadline, and a rule that one failed section does
 * not erase the sections that succeeded. Keeping the orchestration here makes
 * that behaviour testable with a fake generator; the real generators only
 * supply the prompt call and the final quality pass.
 */

export type PathwayBatchScope = {
  label: string;
  notes: string;
  target: number;
};

export type PathwayBatchFailure = {
  label: string;
  error: unknown;
};

export type PathwayBatchRun<T> = {
  items: T[];
  completedSections: number;
  skippedSections: number;
  failures: PathwayBatchFailure[];
};

export async function runPathwayBatches<T>({
  scopes,
  concurrency,
  deadline = Number.POSITIVE_INFINITY,
  progressTarget,
  generate,
  onBatch,
  onProgress,
}: {
  scopes: readonly PathwayBatchScope[];
  concurrency: number;
  deadline?: number;
  /** The requested total, so progress never jumps past the student's target. */
  progressTarget?: number;
  generate: (scope: PathwayBatchScope) => Promise<readonly T[]>;
  /** Persists the merged result after each section, before progress moves. */
  onBatch?: (items: readonly T[]) => Promise<void> | void;
  onProgress?: (completed: number, target: number) => Promise<void> | void;
}): Promise<PathwayBatchRun<T>> {
  if (scopes.length === 0) {
    return {
      items: [],
      completedSections: 0,
      skippedSections: 0,
      failures: [],
    };
  }

  const results: T[][] = scopes.map(() => []);
  const failures: PathwayBatchFailure[] = [];
  const target =
    progressTarget ?? scopes.reduce((sum, scope) => sum + scope.target, 0);
  let nextScope = 0;
  let completed = 0;
  let skippedSections = 0;
  // Section workers finish out of order. Checkpointing is serialized so each
  // write sees the sections already saved by the previous one.
  let batchQueue: Promise<void> = Promise.resolve();

  const worker = async () => {
    while (true) {
      const index = nextScope;
      nextScope += 1;
      if (index >= scopes.length) return;

      const scope = scopes[index]!;
      if (Date.now() >= deadline) {
        skippedSections += 1;
        continue;
      }

      try {
        const batch = await generate(scope);
        results[index] = [...batch];
        completed += batch.length;
        if (onBatch) {
          const merged = results.flat();
          const write = batchQueue.then(() => onBatch(merged));
          batchQueue = write.then(
            () => undefined,
            () => undefined,
          );
          await write;
        }
        try {
          await onProgress?.(Math.min(completed, target), target);
        } catch {
          // Progress is cosmetic; a write failure must not discard a batch.
        }
      } catch (error) {
        failures.push({ label: scope.label, error });
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), scopes.length) },
      () => worker(),
    ),
  );

  return {
    items: results.flat(),
    completedSections: scopes.length - failures.length - skippedSections,
    skippedSections,
    failures,
  };
}
