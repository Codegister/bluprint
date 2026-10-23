import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";

/**
 * Every public Convex function calls this first so friends' study sets can
 * never be read or changed by another account. The error text is safe to show
 * in the UI.
 */
export async function requireUserId(ctx: {
  auth: Parameters<typeof getAuthUserId>[0]["auth"];
}): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Please sign in to continue.");
  }
  return userId;
}
