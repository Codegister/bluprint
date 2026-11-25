import { describe, expect, test } from "bun:test";
import {
  isChatMaterialRequest,
  isStudyMaterialOffer,
  isStudyMaterialRequest,
  isTutorBuildRequest,
} from "../src/convex/lib/tutorAgent";

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

describe("tutor study-material intent", () => {
  test("recognises the ways a student asks for material, not just one phrase", () => {
    for (const question of [
      "Turn these notes into a set",
      "turn some notes into a study set please",
      "Summarise this page into revision notes",
      "Give me the key points of cell division",
      "Make flashcards from this",
      "Ask me an exam question",
      "What are the key points of mitosis?",
      "notes on mitosis please",
    ]) {
      expect(isStudyMaterialRequest(question)).toBe(true);
    }
  });

  test("leaves marking, feature questions and plain explanations alone", () => {
    for (const question of [
      "Why did I get this quiz question wrong?",
      "Mark my answer",
      "What is a study set?",
      "I need help with this quiz",
      "Don't build me a quiz",
      "Explain this topic like I'm new to it",
      "What am I most likely to lose marks on?",
    ]) {
      expect(isStudyMaterialRequest(question)).toBe(false);
    }
  });

  test("material the student points at in the chat is a set request", () => {
    expect(isChatMaterialRequest("Make a set from these notes")).toBe(true);
    expect(isChatMaterialRequest("turn what I pasted into cards")).toBe(true);
    expect(isChatMaterialRequest("Build me a Spanish quiz on topic 1")).toBe(false);
    expect(isChatMaterialRequest("Build me a quiz on cell division")).toBe(false);
  });

  test("every new request to make a set is offered as a button", () => {
    // Set creation used to depend on the wording: an explicit "make a set"
    // auto-built through the course planner, while "turn these notes into a
    // set" offered the button. Both now take the same click.
    for (const question of [
      "Turn these notes into a set",
      "Build me a Spanish quiz on topic 1",
      "Make a study set for unit 2",
      "I want a set of flashcards for cells",
      "Actually, can you generate a set using all the quotes you've given me?",
    ]) {
      expect(isStudyMaterialOffer(question)).toBe(true);
    }
    expect(isStudyMaterialOffer("What is a study set?")).toBe(false);
    expect(isStudyMaterialOffer("Mark my answer")).toBe(false);
  });
});
