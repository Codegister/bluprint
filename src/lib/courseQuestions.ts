import {
  requiresBoardQuestion,
  tierChoicesFor,
} from "@/convex/lib/catalogue";
import { literatureChoicesFor } from "@/convex/lib/literatureChoices";

export type CourseQuestion = "board" | "tier" | "rs" | "lit";

/**
 * The questions a subject needs after it is tapped in course setup.
 *
 * Religious Studies is untiered, so it has no tier question. It still needs
 * its own step: route A or B, the two religions, and the third paper or Areas
 * of Study. Keeping that rule here makes it testable without rendering the
 * setup page.
 */
export function courseQuestionsFor(
  level: string,
  subject: string,
  board?: string,
): CourseQuestion[] {
  const questions: CourseQuestion[] = [];
  if (requiresBoardQuestion(level)) questions.push("board");

  const { tiers, variants } = tierChoicesFor(level, subject);
  if (tiers.length > 0 || variants.length > 0) questions.push("tier");

  if (level === "GCSE" && subject === "Religious Studies") {
    questions.push("rs");
  }

  if (
    level === "GCSE" &&
    subject === "English Literature" &&
    literatureChoicesFor(board ?? "")
  ) {
    questions.push("lit");
  }

  return questions;
}
