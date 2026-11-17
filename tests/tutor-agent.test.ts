import { describe, expect, test } from "bun:test";
import {
  countsForTutorBuild,
  isTutorBuildRequest,
  numberTopics,
  planTutorBuild,
  type TutorAgentCourse,
} from "../src/convex/lib/tutorAgent";

const spanish: TutorAgentCourse = {
  id: "spanish",
  subject: "Spanish",
  level: "GCSE",
  examBoard: "AQA",
  units: [
    {
      title: "Theme 1: Identity and culture",
      topics: [
        { id: "family", title: "Family and relationships" },
        { id: "technology", title: "Technology in everyday life" },
      ],
    },
    {
      title: "Theme 2: Local, national and international areas",
      topics: [
        { id: "holidays", title: "Holidays and travel" },
        { id: "town", title: "Home, town and neighbourhood" },
      ],
    },
  ],
};

const biology: TutorAgentCourse = {
  id: "biology",
  subject: "Biology",
  level: "GCSE",
  examBoard: "AQA",
  units: [
    {
      title: "Cell biology",
      topics: [{ id: "cells", title: "Cell division" }],
    },
  ],
};

describe("tutor build intent", () => {
  test("recognises a request to build a named quiz", () => {
    expect(isTutorBuildRequest("Build me a Spanish quiz on topic 1")).toBe(true);
    expect(isTutorBuildRequest("I want a set of flashcards for cells")).toBe(true);
    expect(isTutorBuildRequest("Could you make a study set from unit 2?")).toBe(true);
  });

  test("does not treat a question about a quiz as a build", () => {
    expect(isTutorBuildRequest("Why did I get this quiz question wrong?")).toBe(false);
    expect(isTutorBuildRequest("What is a study set?")).toBe(false);
    expect(isTutorBuildRequest("I need help with this quiz")).toBe(false);
    expect(isTutorBuildRequest("Don't build me a quiz")).toBe(false);
  });
});

describe("tutor build planner", () => {
  test("numbers topics across the whole course, not per unit", () => {
    expect(numberTopics(spanish).map((topic) => topic.number)).toEqual([1, 2, 3, 4]);
    expect(numberTopics(spanish)[2]?.unitTitle).toBe(
      "Theme 2: Local, national and international areas",
    );
  });

  test("builds topic 1 in a subject named from a different course", () => {
    const plan = planTutorBuild("Build me a Spanish quiz on topic 1", [biology, spanish], {
      currentCourseId: "biology",
    });
    expect(plan.status).toBe("build");
    if (plan.status !== "build") return;
    expect(plan.courseId).toBe("spanish");
    expect(plan.topicIds).toEqual(["family"]);
    expect(plan.label).toBe("Topic 1 · Family and relationships");
  });

  test("uses the open course when the message does not name a subject", () => {
    const plan = planTutorBuild("Build me a quiz on cell division", [biology, spanish], {
      currentCourseId: "biology",
    });
    expect(plan.status).toBe("build");
    if (plan.status !== "build") return;
    expect(plan.topicIds).toEqual(["cells"]);
  });

  test("a named unit builds every topic in that unit", () => {
    const plan = planTutorBuild("Make a study set for unit 2", [biology, spanish], {
      currentCourseId: "spanish",
    });
    expect(plan.status).toBe("build");
    if (plan.status !== "build") return;
    expect(plan.topicIds).toEqual(["holidays", "town"]);
    expect(plan.label).toBe("Topics 3–4");
  });

  test("a unit-scoped conversation can build the whole unit", () => {
    const plan = planTutorBuild("Build me a quiz", [spanish], {
      currentCourseId: "spanish",
      unitTitle: "Theme 1: Identity and culture",
    });
    expect(plan.status).toBe("build");
    if (plan.status !== "build") return;
    expect(plan.topicIds).toEqual(["family", "technology"]);
  });

  test("asks for a topic rather than guessing across a whole course", () => {
    expect(
      planTutorBuild("Build me a Spanish quiz", [spanish], {
        currentCourseId: "spanish",
      }),
    ).toEqual({ status: "needs-topic", courseId: "spanish", subject: "Spanish" });
  });

  test("asks for a course when no ready course matches", () => {
    expect(planTutorBuild("Build me a Chemistry quiz on topic 1", [biology])).toEqual({
      status: "needs-course",
      subjects: ["Biology"],
    });
  });

  test("a tutor build with no size named builds the account maximum", () => {
    expect(countsForTutorBuild("Build me a quiz on topic 1")).toEqual({
      cards: 100,
      quiz: 100,
      exam: 100,
    });
    expect(countsForTutorBuild("Make a study set on topic 1")).toEqual({
      cards: 100,
      quiz: 100,
      exam: 100,
    });
  });

  test("explicit counts replace the account maximum", () => {
    expect(
      countsForTutorBuild(
        "Build me 24 flashcards, 12 quiz questions and 6 exam questions on holidays",
      ),
    ).toEqual({ cards: 24, quiz: 12, exam: 6 });
    expect(countsForTutorBuild("Build me a quiz with 8 questions")).toEqual({
      cards: 5,
      quiz: 8,
      exam: 3,
    });
  });

  test("explicit counts stop at the account maximum, not 12/6/5", () => {
    expect(countsForTutorBuild("Build 150 flashcards on cells")).toEqual({
      cards: 100,
      quiz: 3,
      exam: 3,
    });
  });

  test("a planned build carries the requested counts", () => {
    const plan = planTutorBuild(
      "Build me 24 flashcards, 12 quiz questions and 6 exam questions on holidays",
      [spanish],
    );
    expect(plan.status).toBe("build");
    if (plan.status !== "build") return;
    expect(plan.counts).toEqual({ cards: 24, quiz: 12, exam: 6 });
  });

  test("a title with no other match is resolved without a topic number", () => {
    const plan = planTutorBuild("Build me a quiz on holidays and travel", [spanish], {
      currentCourseId: "spanish",
    });
    expect(plan.status).toBe("build");
    if (plan.status !== "build") return;
    expect(plan.topicIds).toEqual(["holidays"]);
  });

  test("a course-wide topic number keeps its meaning inside a unit thread", () => {
    const plan = planTutorBuild("Build me a quiz on topic 3", [spanish], {
      currentCourseId: "spanish",
      unitTitle: "Theme 1: Identity and culture",
    });
    expect(plan.status).toBe("build");
    if (plan.status !== "build") return;
    expect(plan.topicIds).toEqual(["holidays"]);
  });

  test("a generic study-set request still uses the open course", () => {
    const plan = planTutorBuild("Build me a study set on topic 1", [spanish], {
      currentCourseId: "spanish",
    });
    expect(plan.status).toBe("build");
    if (plan.status !== "build") return;
    expect(plan.topicIds).toEqual(["family"]);
  });

  test("builds one set for each ready course, not one chat answer", () => {
    const plan = planTutorBuild("Build me a set for each of my courses", [
      { ...spanish, nextTopicId: "holidays" },
      biology,
    ]);
    expect(plan.status).toBe("build-many");
    if (plan.status !== "build-many") return;
    expect(plan.plans.map((entry) => entry.courseId)).toEqual(["spanish", "biology"]);
    // Each course starts at its next unfinished topic, falling back to topic 1.
    expect(plan.plans.map((entry) => entry.topicIds)).toEqual([["holidays"], ["cells"]]);
    expect(plan.plans.map((entry) => entry.label)).toEqual([
      "Topic 3 · Holidays and travel",
      "Topic 1 · Cell division",
    ]);
    expect(plan.plans[0]?.counts).toEqual({ cards: 100, quiz: 100, exam: 100 });
  });

  test("recognises the other ways students ask for every course", () => {
    for (const question of [
      "Make a study set for every course",
      "Build one set per course",
      "Build sets for all of my courses",
    ]) {
      expect(isTutorBuildRequest(question)).toBe(true);
      expect(planTutorBuild(question, [spanish, biology]).status).toBe("build-many");
    }
  });

  test("a named subject keeps an every-course request to that subject", () => {
    const plan = planTutorBuild("Build me a Spanish set for each of my courses", [
      spanish,
      biology,
    ]);
    expect(plan.status).toBe("build-many");
    if (plan.status !== "build-many") return;
    expect(plan.plans.map((entry) => entry.courseId)).toEqual(["spanish"]);
  });
});
