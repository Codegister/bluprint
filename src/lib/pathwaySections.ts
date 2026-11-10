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

/**
 * One specification part, as the pathway numbers it. A part keeps every topic
 * it contains, so the set builder offers the same 15 parts as the pathway
 * rather than flattening them into 33 separate topic checkboxes.
 */
export type PathwayPartOption = {
  id: string;
  title: string;
  /** The part's position across the course, starting at one. */
  number: number;
  /** Every topic in this part, in pathway order. */
  topicIds: string[];
  topicCount: number;
};

/** The most topics a legacy `sections` call can cover, matching the server. */
export const MAX_COMBINED_TOPICS = 12;

/**
 * The pathway's parts in reading order. Each part is one item in the set
 * builder, so its count always matches the part count on the pathway. Topics
 * are kept with their part; selecting a part means selecting every topic in it.
 */
export function pathwayPartOptions(
  units: readonly PathwayUnit[],
): PathwayPartOption[] {
  return units.map((unit, index) => {
    const topicIds = unit.topics.map((topic) => topic.id);
    return {
      id: `part-${index + 1}`,
      title: unit.title,
      number: index + 1,
      topicIds,
      topicCount: topicIds.length,
    };
  });
}

/** Maps topic ids back to the parts that contain them. */
export function pathwayPartIdsForTopics(
  parts: readonly PathwayPartOption[],
  topicIds: readonly string[],
): string[] {
  const wanted = new Set(topicIds);
  return parts
    .filter((part) => part.topicIds.some((topicId) => wanted.has(topicId)))
    .map((part) => part.id);
}

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
