/**
 * The option scope stored in a course-set brief.
 *
 * Two English Literature courses can share a topic position but study different
 * set texts, and two RS courses can share a topic position but choose different
 * religions or papers. The scope line lets the course page and the reuse cache
 * tell those sets apart.
 */

export type CourseScopeSource = {
  subject: string;
  level: string;
  litShakespeare?: string | null;
  litNovel?: string | null;
  litModern?: string | null;
  poetryTheme?: string | null;
  rsRoute?: string | null;
  rsReligion?: string | null;
  rsReligion2?: string | null;
  rsSpec?: string | null;
  rsSpec2?: string | null;
};

function clean(value?: string | null): string {
  return value?.trim() ?? "";
}

/** The chosen options in the same stable order for every brief. */
export function courseOptionsLine(course: CourseScopeSource): string {
  if (/english literature/i.test(course.subject) && /gcse/i.test(course.level)) {
    return [
      clean(course.litShakespeare) ? `Shakespeare: ${clean(course.litShakespeare)}` : "",
      clean(course.litNovel) ? `19th-century novel: ${clean(course.litNovel)}` : "",
      clean(course.litModern) ? `Modern text: ${clean(course.litModern)}` : "",
      clean(course.poetryTheme) ? `Poetry: ${clean(course.poetryTheme)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (/religious studies/i.test(course.subject)) {
    return [
      clean(course.rsRoute) ? `Route: ${clean(course.rsRoute)}` : "",
      clean(course.rsReligion) ? `Religion: ${clean(course.rsReligion)}` : "",
      clean(course.rsReligion2)
        ? `Second religion: ${clean(course.rsReligion2)}`
        : "",
      clean(course.rsSpec) ? `Paper/Area: ${clean(course.rsSpec)}` : "",
      clean(course.rsSpec2) ? `Second paper/Area: ${clean(course.rsSpec2)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

/** Reads the scope line from a stored set brief. */
export function courseOptionsFromNotes(notes?: string | null): string {
  const line = notes
    ?.split(/\r?\n/)
    .find((entry) => /^Course options:/i.test(entry.trim()));
  return line?.replace(/^Course options:\s*/i, "").trim().toLowerCase() ?? "";
}

/**
 * True when a set's brief belongs to the course's current options. Courses
 * without option choices always match. A brief written before the scope line
 * existed does not: it is stale, so the topic is rebuilt with the chosen texts
 * or religions instead of opening the old set.
 */
export function courseScopeMatches(
  course: CourseScopeSource,
  notes?: string | null,
): boolean {
  const expected = courseOptionsLine(course);
  if (!expected) return true;
  return courseOptionsFromNotes(notes) === expected.toLowerCase();
}
