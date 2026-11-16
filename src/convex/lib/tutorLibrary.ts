/**
 * The material the home tutor reads.
 *
 * A student can have several courses, and the tutor should not make them pick
 * one before asking a question. Rather than concatenating every full pathway
 * and letting the last courses fall off the end of the prompt, each course gets
 * an equal share of the context budget. Every course header and unit is kept;
 * extra detail is trimmed first when the library is large.
 *
 * This module is dependency-free so the Convex runtime and the tests can share
 * exactly the same material shape.
 */

export type TutorLibraryTopic = {
  title: string;
  specReference?: string | null;
  summary: string;
  keyPoints: string[];
  examSkill?: string | null;
};

export type TutorLibraryUnit = {
  title: string;
  summary: string;
  topics: TutorLibraryTopic[];
};

export type TutorLibraryCourse = {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string | null;
  options?: string;
  pathway: {
    overview: string;
    examFormat: string;
    units: TutorLibraryUnit[];
  };
};

/** Same ceiling the tutor prompt applies to study material. */
export const LIBRARY_MATERIAL_LIMIT = 12_000;

/** Renders one course inside its share of the prompt. */
function courseMaterial(
  course: TutorLibraryCourse,
  budget: number,
): string {
  const lines = [
    `# ${course.level} ${course.subject} (${course.examBoard})`,
    course.tier ? `Tier: ${course.tier}` : "",
    `How it is assessed: ${course.pathway.examFormat}`,
    course.options
      ? `Chosen options (discuss only these texts/religions): ${course.options}`
      : "",
    `Overview: ${course.pathway.overview}`,
  ].filter(Boolean);

  let size = lines.join("\n").length;
  let clipped = false;

  const add = (line: string): boolean => {
    if (size + line.length + 1 > budget) {
      clipped = true;
      return false;
    }
    lines.push(line);
    size += line.length + 1;
    return true;
  };

  for (const unit of course.pathway.units) {
    if (!add(`## ${unit.title}`)) break;
    add(unit.summary);

    for (const topic of unit.topics) {
      const reference = topic.specReference ? ` (${topic.specReference})` : "";
      const topicLine = `- ${topic.title}${reference}: ${topic.summary}`;
      if (!add(topicLine)) break;

      for (const point of topic.keyPoints) {
        if (!add(`  * ${point}`)) break;
      }
      if (topic.examSkill) add(`  Exam skill: ${topic.examSkill}`);
    }
  }

  if (clipped) {
    lines.push("(More detail was omitted so every course fits in this answer.)");
  }
  return lines.join("\n");
}

/**
 * One bounded block covering every course.
 *
 * With a few courses the budget is large enough for full summaries and key
 * points. With many, each block is shortened evenly rather than dropping
 * whole courses from the end.
 */
export function libraryTutorMaterial(
  courses: TutorLibraryCourse[],
  maxChars = LIBRARY_MATERIAL_LIMIT,
): string {
  if (courses.length === 0) return "";
  // A little of each share is reserved for separators and the clipped-detail
  // sentence, so the joined blocks stay inside the prompt ceiling.
  const budget = Math.max(160, Math.floor(maxChars / courses.length) - 80);
  return courses
    .map((course) => courseMaterial(course, budget))
    .join("\n\n");
}
