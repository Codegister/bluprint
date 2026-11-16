import { describe, expect, test } from "bun:test";

import {
  COURSE_SCOPE_VERSION,
  courseOptionsLine,
  courseScopeFor,
  courseScopeMatches,
} from "../src/convex/lib/courseScope";

const literature = {
  subject: "English Literature",
  level: "GCSE",
  litShakespeare: "Macbeth",
  litNovel: "A Christmas Carol",
  litModern: "An Inspector Calls",
  poetryTheme: "Power & Conflict",
};

const religiousStudies = {
  subject: "Religious Studies",
  level: "GCSE",
  rsRoute: "Edexcel Religious Studies A",
  rsReligion: "Christianity",
  rsReligion2: "Islam",
  rsSpec: "Philosophy and Ethics",
};

function brief(options: string): string {
  return [
    "Course: GCSE English Literature",
    "Exam board: AQA",
    `Course options: ${options}`,
    "",
    "Syllabus scope for this set:",
    "",
    "Topic: Macbeth",
  ].join("\n");
}

describe("course option scope", () => {
  test("an old brief without a scope line is stale", () => {
    expect(courseScopeMatches(literature, "Course: GCSE English Literature")).toBe(
      false,
    );
    expect(
      courseScopeMatches(
        religiousStudies,
        "Course: GCSE Religious Studies\nExam board: Edexcel",
      ),
    ).toBe(false);
  });

  test("a brief with the same chosen texts is current", () => {
    expect(
      courseScopeMatches(literature, brief(courseOptionsLine(literature))),
    ).toBe(true);
  });

  test("a brief naming another Shakespeare play or religion is stale", () => {
    expect(
      courseScopeMatches(
        literature,
        brief("Shakespeare: Romeo & Juliet · 19th-century novel: A Christmas Carol"),
      ),
    ).toBe(false);
    expect(
      courseScopeMatches(
        religiousStudies,
        brief(
          "Route: Edexcel Religious Studies A · Religion: Christianity · Second religion: Judaism",
        ),
      ),
    ).toBe(false);
  });

  test("a structured scope matches only the same choices", () => {
    const scope = courseScopeFor(literature);
    expect(scope?.version).toBe(COURSE_SCOPE_VERSION);
    expect(scope?.choices).toContain("Shakespeare: Macbeth");
    expect(courseScopeMatches(literature, undefined, scope)).toBe(true);
    expect(
      courseScopeMatches(
        { ...literature, litShakespeare: "Romeo & Juliet" },
        undefined,
        scope,
      ),
    ).toBe(false);
  });

  test("courses without option choices are never made stale", () => {
    expect(
      courseScopeMatches(
        { subject: "Biology", level: "GCSE" },
        "Course: GCSE Biology",
      ),
    ).toBe(true);
  });
});
