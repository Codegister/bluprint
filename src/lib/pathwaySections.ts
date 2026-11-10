/**
 * The topics a course set can cover. This lives outside the page so the picker
 * and its tests use exactly the same reading order and de-duplication.
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
  /** The topic's position across the whole course, starting at one. */
  number: number;
};

/** The most topics a legacy `sections` call can cover, matching the server. */
export const MAX_COMBINED_TOPICS = 12;

/**
 * Flattens the pathway in reading order and removes duplicate topic ids. Every
 * topic is returned with the number the course shows for it.
 */
export function pathwayTopicOptions(
  units: readonly PathwayUnit[],
): SectionOption[] {
  const seen = new Set<string>();
  const outline: SectionOption[] = [];

  for (const unit of units) {
    for (const topic of unit.topics) {
      if (seen.has(topic.id)) continue;
      seen.add(topic.id);
      outline.push({
        id: topic.id,
        title: topic.title,
        unit: unit.title,
        number: outline.length + 1,
      });
    }
  }

  return outline;
}

/**
 * The run of topics from `topicId` onwards, kept for callers that build from a
 * single start point. The number on each option stays its course-wide number.
 */
export function pathwaySectionOptions(
  units: readonly PathwayUnit[],
  topicId: string,
  limit = MAX_COMBINED_TOPICS,
): SectionOption[] {
  const outline = pathwayTopicOptions(units);
  const start = outline.findIndex((entry) => entry.id === topicId);
  if (start < 0) return [];
  const count = Math.max(1, Math.floor(limit));
  return outline.slice(start, start + count);
}
