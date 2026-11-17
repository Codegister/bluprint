import { describe, expect, test } from "bun:test";
import {
  NO_MATERIAL_IN_CHAT,
  multiBuildNote,
  tutorBuildNote,
  type TutorBuildOutcome,
} from "../src/convex/lib/tutorBuildNotes";
import type { TutorBuildPlan } from "../src/convex/lib/tutorAgent";

function plan(subject: string, label: string): TutorBuildPlan {
  return {
    status: "build",
    courseId: subject.toLowerCase(),
    subject,
    topicIds: [`${subject}-topic`],
    firstTopicId: `${subject}-topic`,
    label,
    counts: { cards: 10, quiz: 5, exam: 3 },
  };
}

function started(
  subject: string,
  label: string,
  setId: string,
): TutorBuildOutcome<string> {
  return {
    plan: plan(subject, label),
    setId,
    created: true,
    cached: false,
    started: true,
  };
}

describe("multi-course build notes", () => {
  test("names every course and returns a link for each set", () => {
    const { note, builtSetIds } = multiBuildNote([
      started("Biology", "Topic 1 · Cell division", "set-bio"),
      started("Spanish", "Topic 3 · Holidays and travel", "set-spa"),
    ]);

    expect(builtSetIds).toEqual(["set-bio", "set-spa"]);
    expect(note).toContain("Biology: Topic 1 · Cell division (building now)");
    expect(note).toContain("Spanish: Topic 3 · Holidays and travel (building now)");
    expect(note).toContain("In one short sentence per set");
  });

  test("says ready when a course reused a finished build", () => {
    const { note } = multiBuildNote([
      {
        plan: plan("Biology", "Topic 1"),
        setId: "set-bio",
        created: false,
        cached: true,
        started: false,
      },
    ]);
    expect(note).toContain("(ready to study now)");
  });

  test("says saved when the background build could not be queued", () => {
    const { note } = multiBuildNote([
      {
        plan: plan("Biology", "Topic 1"),
        setId: "set-bio",
        created: true,
        cached: false,
        started: false,
      },
    ]);
    expect(note).toContain("(saved, open it to start the build)");
  });

  test("a failed course is named without hiding the ones that built", () => {
    const { note, builtSetIds } = multiBuildNote([
      started("Biology", "Topic 1", "set-bio"),
      {
        plan: plan("Chemistry", "Topic 2"),
        created: false,
        cached: false,
        started: false,
        failure: "You have reached your build limit. Nothing was built, so no tokens were spent.",
      },
    ]);

    expect(builtSetIds).toEqual(["set-bio"]);
    expect(note).toContain("Biology: Topic 1 (building now)");
    expect(note).toContain(
      "These could not start: Chemistry — You have reached your build limit.",
    );
  });

  test("no build at all says nothing was built and still forbids pasting material", () => {
    const { note, builtSetIds } = multiBuildNote([
      {
        plan: plan("Biology", "Topic 1"),
        created: false,
        cached: false,
        started: false,
        failure: "Please verify your email before building a set.",
      },
    ]);

    expect(builtSetIds).toEqual([]);
    expect(note).toContain("no build could start");
    expect(note).toContain("Biology — Please verify your email");
    expect(note).toContain(NO_MATERIAL_IN_CHAT);
  });

  test("every multi-course note tells the model not to write set content", () => {
    const notes = multiBuildNote([started("Biology", "Topic 1", "set-bio")]);
    expect(notes.note).toContain(NO_MATERIAL_IN_CHAT);
  });
});

describe("single build notes", () => {
  test("a started build says it is building, not ready", () => {
    const note = tutorBuildNote(started("Biology", "Topic 1", "set-bio"));
    expect(note).toContain("background build has started");
    expect(note).toContain("Say it is building now, not ready");
  });

  test("a failed build says nothing was built and forbids material in chat", () => {
    const note = tutorBuildNote({
      plan: plan("Biology", "Topic 1"),
      created: false,
      cached: false,
      started: false,
      failure: "That topic selection is too large for one set.",
    });
    expect(note).toContain("the build did not start");
    expect(note).toContain("That topic selection is too large for one set.");
    expect(note).toContain(NO_MATERIAL_IN_CHAT);
  });
});
