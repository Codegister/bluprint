/**
 * The topics a course set can cover, starting from the topic the student
 * picked. This lives outside the page so the picker and its tests use exactly
 * the same order, de-duplication and limit.
 */

export type PathwayTopic = {
  id: string;
  title: string;
};

export type PathwayUnit = {
  title: string;
  topics: readonly PathwayTopic[];
};

export type SectionOption = {
  id: string;
  title: string;
  unit: string;
};

/** The most topics one combined set can cover, matching the server. */
export const MAX_COMBINED_TOPICS = 12;

/**
 * Flattens the pathway in reading order, removes duplicate topic ids, and
 * returns the run of topics from `topicId` onwards. The returned length is the
 * only count the picker may show, so a ten-topic course can never offer twelve.
 */
export function pathwaySectionOptions(
  units: readonly PathwayUnit[],
  topicId: string,
  limit = MAX_COMBINED_TOPICS,
): SectionOption[] {
  const seen = new Set<string>();
  const outline: SectionOption[] = [];

  for (const unit of units) {
    for (const topic of unit.topics) {
      if (seen.has(topic.id)) continue;
      seen.add(topic.id);
      outline.push({ id: topic.id, title: topic.title, unit: unit.title });
    }
  }

  const start = outline.findIndex((entry) => entry.id === topicId);
  if (start < 0) return [];
  const count = Math.max(1, Math.floor(limit));
  return outline.slice(start, start + count);
}
