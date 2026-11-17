/**
 * The tutor's marking contract, kept separate from the rest of the prompt so
 * it can be reviewed and tested. The audit's weak answer ("the enzyme gets
 * killed by the heat") passed because the tutor corrected a different point
 * and gave no mark. These rules make that answer lose the mark and require the
 * missing points to be named.
 */
export function tutorMarkingRules(): string {
  return [
    "MARKING A STUDENT ANSWER: when the student answers a question you asked, mark it before teaching anything else.",
    "Give a mark out of the marks available, in the form 'Mark: X/N'. If the question did not state a tariff, use one mark per distinct credited point and say 'Mark: X/N'.",
    "Credit only points the answer actually makes. Name each credited point and quote the student's words for it.",
    "Name each missing mark point in plain words. Do not say 'good answer' or award a mark for effort, length or confidence.",
    "Correct every scientifically wrong phrase, even when the rest of the answer is right. An enzyme is not 'killed' by heat: it is denatured, and its active site changes shape so the substrate no longer fits. A cell is not 'killed' by boiling in the same sense either; use the precise process.",
    "When an answer contains a misconception, say 'Not credited:' and give the correct science. Do not let the misconception pass because a different point was right.",
    "For a strong answer, still list the credited points and say 'Full marks'. For a weak answer, give the lower mark and the exact points that would earn the rest.",
    "Keep the tone encouraging, but never inflate the mark to be kind.",
  ].join("\n");
}

/** A short deterministic check used by the tutor tests and the prompt builder. */
export function looksLikeStudentAnswer(message: string): boolean {
  const text = message.trim();
  if (text.length < 8) return false;
  if (/^(?:what|why|how|when|where|which|who|explain|describe|give|show|tell)\b/i.test(text)) {
    return false;
  }
  // A question back to the tutor is not an answer, whatever its length: this is
  // what stopped "Are you sure those are all the topics?" being marked 0/1.
  if (/^(?:are|were|is|was|do|did|does|can|could|will|would|should|have|has)\s+you\b/i.test(text)) {
    return false;
  }
  return (
    /\b(?:because|so|therefore|it is|they are|the .+ (?:is|are|has|have)|this .+ (?:is|are))\b/i.test(
      text,
    ) || text.split(/\s+/).length >= 4
  );
}

/**
 * Whether this turn is marking an answer the tutor asked for.
 *
 * The marking contract used to be part of every tutor prompt, so an ordinary
 * question such as "Are you sure those are all the topics?" was answered as a
 * marked script: "Mark: 0/1. Not credited: ...". Marking now needs a question
 * from the tutor's own last reply and a message that reads as an answer, or a
 * direct request to be marked.
 */
export function shouldMarkAnswer(
  previousAssistant: string | undefined,
  message: string,
): boolean {
  const text = message.trim();
  // "Mark my answer", "grade this" - the student asked for it outright.
  if (/\b(?:mark|grade)\s+(?:my|this|it|that|these|them)\b/i.test(text)) return true;
  if (!previousAssistant) return false;
  if (!askedForAnAnswer(previousAssistant)) return false;
  return looksLikeStudentAnswer(text);
}

/** True when the reply left the student something to answer. */
function askedForAnAnswer(reply: string): boolean {
  const text = reply.trim();
  if (!text.includes("?")) return false;
  // Either a numbered question list or a question that closes the reply.
  return (
    /\?\s*$/.test(text) ||
    /(?:^|\n)\s*\d{1,2}[.)]\s+[^\n]*\?/.test(text)
  );
}
