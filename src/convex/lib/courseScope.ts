/**
 * The option scope stored on a course set.
 *
 * A pathway id is a position in the map, not the identity of its content. Two
 * English Literature courses put a different play in the same slot, and two RS
 * courses put different religions in the same slot. The scope is what makes
 * those sets distinct.
 */

export const COURSE_SCOPE_VERSION = 1;

export type CourseScopeSource = {
  subject: string;
  level: string;
  examBoard: string;
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

export type CourseOptionScope = {
  version: number;
  key: string;
  subject: string;
  level: string;
  examBoard: string;
  choices: string[];
};

function clean(value?: string | null): string {
  return value?.trim() ?? "";
}

/** The chosen options in the same stable order for every brief. */
function courseOptionChoices(course: CourseScopeSource): string[] {
  if (/english literature/i.test(course.subject) && /gcse/i.test(course.level)) {
    return [
      clean(course.litShakespeare) ? `Shakespeare: ${clean(course.litShakespeare)}` : "",
      clean(course.litNovel) ? `19th-century novel: ${clean(course.litNovel)}` : "",
      clean(course.litModern) ? `Modern text: ${clean(course.litModern)}` : "",
      clean(course.poetryTheme) ? `Poetry: ${clean(course.poetryTheme)}` : "",
    ].filter(Boolean);
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
    ].filter(Boolean);
  }
  return [];
}

/** The old single-line form still written into a course brief. */
export function courseOptionsLine(course: CourseScopeSource): string {
  return courseOptionChoices(course).join(" · ");
}

/** A stable identity for the current course choices and qualification. */
function courseOptionsKey(course: CourseScopeSource): string {
  return [
    clean(course.subject),
    clean(course.level),
    clean(course.examBoard),
    ...courseOptionChoices(course),
  ]
    .join("|")
    .toLowerCase();
}

/** A structured scope, or null for courses with no optional content. */
export function courseScopeFor(
  course: CourseScopeSource,
): CourseOptionScope | null {
  const choices = courseOptionChoices(course);
  if (choices.length === 0) return null;
  return {
    version: COURSE_SCOPE_VERSION,
    key: courseOptionsKey(course),
    subject: clean(course.subject),
    level: clean(course.level),
    examBoard: clean(course.examBoard),
    choices,
  };
}

/** Reads the scope line from a stored set brief. */
export function courseOptionsFromNotes(notes?: string | null): string {
  const line = notes
    ?.split(/\r?\n/)
    .find((entry) => /^Course options:/i.test(entry.trim()));
  return line?.trim().replace(/^Course options:\s*/i, "").toLowerCase() ?? "";
}

/**
 * True when a set belongs to the course's current options.
 *
 * New sets carry their structured scope. Sets made during the earlier notes
 * fallback still match through their brief, while genuinely old sets with no
 * scope line are stale.
 */
export function courseScopeMatches(
  course: CourseScopeSource,
  notes?: string | null,
  scope?: CourseOptionScope | null,
): boolean {
  const expected = courseScopeFor(course);
  if (!expected) return true;
  if (scope) {
    return scope.version === expected.version && scope.key === expected.key;
  }
  return courseOptionsFromNotes(notes) === courseOptionsLine(course).toLowerCase();
}
