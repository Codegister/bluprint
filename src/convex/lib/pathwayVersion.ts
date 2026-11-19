/**
 * Bumped whenever stored pathways must be rebuilt for a content or filtering
 * change. Course recovery compares this value with the saved pathway, so a bump
 * is enough to rebuild every old map on the next visit.
 *
 * 4: option-scoped Literature filtering now applies to every outline source,
 *    including Cognito and the starter map.
 * 5: exam-technique pages moved out of content topics into each unit's
 *    `skills` list, so the set builder can no longer pick them.
 */
export const CURRENT_PATHWAY_VERSION = 5;
