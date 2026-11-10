/**
 * The one preflight every action that calls a model uses.
 *
 * Only an explicit `configured: false` is treated as unavailable. While the
 * status query is still loading (`undefined`) the action is allowed to run, so
 * a slow status request can never block something the server could have done.
 */
export const AI_NOT_CONFIGURED_MESSAGE =
  "AI isn't connected in this workspace yet. Nothing was started, and your saved work is still available.";

export function isAiUnavailable(
  status: { configured: boolean } | null | undefined,
): boolean {
  return status?.configured === false;
}
