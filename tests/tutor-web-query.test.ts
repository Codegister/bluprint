import { describe, expect, test } from "bun:test";
import { searchQueryFor } from "../src/convex/lib/webSearch";

describe("tutor web query", () => {
  test("does not search a question about the conversation", () => {
    expect(searchQueryFor("Are you sure those are all the topics?")).toBe("");
    expect(searchQueryFor("What do you mean by that?")).toBe("");
    expect(searchQueryFor("those are all the topics?")).toBe("");
  });

  test("does not search an agreement with a set offer", () => {
    expect(searchQueryFor("Ok, then, proceed to set generation")).toBe("");
    expect(searchQueryFor("go ahead")).toBe("");
    expect(searchQueryFor("create those sets")).toBe("");
  });

  test("keeps a real subject question, minus the conversational opener", () => {
    expect(searchQueryFor("Explain how enzymes denature")).toBe(
      "Explain how enzymes denature",
    );
    expect(searchQueryFor("Ok, so what is mitosis?")).toBe("what is mitosis?");
    expect(searchQueryFor("Can you explain osmosis?")).toBe("explain osmosis?");
  });

  test("refuses a message with no subject words left", () => {
    expect(searchQueryFor("yes")).toBe("");
    expect(searchQueryFor("thanks, sure")).toBe("");
    expect(searchQueryFor("")).toBe("");
  });
});
