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

  test("a quiz request asks for more quiz questions than a normal set", () => {
    expect(countsForTutorBuild("Build me a quiz on topic 1")).toEqual({
      cards: 5,
      quiz: 10,
      exam: 3,
    });
    expect(countsForTutorBuild("Make a study set on topic 1")).toEqual({
      cards: 10,
      quiz: 5,
      exam: 3,
    });
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
});
