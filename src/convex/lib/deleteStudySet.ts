import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { forgetStudySetReuse } from "./studySetReuse";

/**
 * Deletes every row owned by one study set.
 *
 * Stale course sets are removed rather than shown, so this must leave no
 * orphaned cards, attempts, tutor turns, images or cache rows behind. A stale
 * set that is mid-build simply has no set row to write into once this finishes,
 * which the generation stages already treat as a cancelled build.
 */
export async function deleteStudySetCascade(
  ctx: MutationCtx,
  setId: Id<"studySets">,
): Promise<boolean> {
  const set = await ctx.db.get(setId);
  if (!set) return false;

  for (const table of [
    "flashcards",
    "quizQuestions",
    "examQuestions",
    "quizAttempts",
    "reviewEvents",
    "tutorMessages",
  ] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }

  // Mock attempts already have a user-and-set index, so no separate set-only
  // index is needed just for deletion.
  const mocks = await ctx.db
    .query("mockAttempts")
    .withIndex("by_user_set", (q) =>
      q.eq("userId", set.userId).eq("setId", setId),
    )
    .collect();
  for (const row of mocks) await ctx.db.delete(row._id);

  for (const imageId of set.sourceImageIds) {
    try {
      await ctx.storage.delete(imageId);
    } catch {
      // A file removed by an earlier partial cleanup must not block the set.
    }
  }

  await forgetStudySetReuse(ctx, setId);
  await ctx.db.delete(setId);
  return true;
}
