import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Sits a saved past paper question by question.
 *
 * Each answer is marked against the paper's own mark scheme by the same
 * examiner prompt as a study set's exam questions, so the score is deliberately
 * strict. The model answer and marking guide stay hidden until grading, which
 * keeps the attempt honest.
 */
export function PastPaperPractice({
  questions,
  qualification,
}: {
  questions: Doc<"pastPaperQuestions">[];
  qualification?: string;
}) {
  const gradeAnswer = useAction(api.ai.gradePastPaperAnswer);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((question) => [question._id, question.userAnswer ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  if (questions.length === 0) {
    return (
      <div className="rounded-[2rem] border border-border bg-white p-10 text-center">
        <p className="text-sm text-muted-foreground">
          This paper has no questions yet.
        </p>
      </div>
    );
  }

  const handleMark = async (question: Doc<"pastPaperQuestions">) => {
    const answer = (answers[question._id] ?? "").trim();
    if (answer.length < 15) {
      setErrors((current) => ({
        ...current,
        [question._id]: "Write a fuller answer before sending it for grading.",
      }));
      return;
    }

    setErrors((current) => ({ ...current, [question._id]: "" }));
    setGradingId(question._id);
    try {
      const result = await gradeAnswer({ questionId: question._id, answer });
      setAnswers((current) => ({ ...current, [question._id]: answer }));
      toast.success(`Marked: ${result.awardedMarks}/${result.marks}`);
    } catch (error) {
      const message = readableError(error, "Could not mark that answer.");
      setErrors((current) => ({ ...current, [question._id]: message }));
      toast.error(message);
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="rounded-[1.6rem] border border-border bg-white p-5">
        <p className="font-display text-base font-bold text-brand-ink">
          Attempt the paper, then mark each answer
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {qualification
            ? `Marked using ${qualification} conventions. `
            : ""}
          Write a full answer for each question before marking it. The model
          answer and mark scheme unlock after marking, so the score is what an
          examiner would give, not what looks familiar.
        </p>
      </div>

      {questions.map((question, index) => {
        const answer = answers[question._id] ?? "";
        const isGrading = gradingId === question._id;
        const graded = question.awardedMarks !== undefined && Boolean(question.feedback);
        const score = question.awardedMarks ?? 0;
        const scorePercent = question.marks
          ? Math.round((score / question.marks) * 100)
          : 0;

        return (
          <article key={question._id} className="rounded-[1.6rem] border border-border bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Question {index + 1} of {questions.length}
              </span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-panel px-3 py-1 text-xs font-semibold text-brand-ink/70">
                  {question.marks} marks
                </span>
                {graded && (
                  <span className="rounded-full bg-[#E9FBF3] px-3 py-1 text-xs font-semibold text-[#128A5B]">
                    {score}/{question.marks}
                  </span>
                )}
              </div>
            </div>

            <p className="mt-3 font-display text-[1.1rem] font-bold leading-snug text-brand-ink sm:text-[1.25rem]">
              {question.question}
            </p>

            <Textarea
              value={answer}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [question._id]: event.target.value,
                }))
              }
              placeholder="Write your answer here…"
              rows={6}
              maxLength={5000}
              disabled={isGrading}
              className="mt-4 min-h-[140px] resize-y rounded-2xl border-border bg-white text-sm leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/60 focus-visible:border-[#B9A6FF] focus-visible:ring-[#7C5CFF]/15"
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {answer.trim().length} characters · aim for {question.marks} clear
                point{question.marks === 1 ? "" : "s"}
              </p>
              <Button
                onClick={() => void handleMark(question)}
                disabled={isGrading}
                className={cn(
                  "h-10 rounded-full px-5 text-sm font-semibold sm:w-auto",
                  graded
                    ? "bg-[#E9FBF3] text-[#128A5B] hover:bg-[#DDF7EB]"
                    : "bg-[#191B27] text-white hover:bg-[#2A2D3E]",
                )}
              >
                {isGrading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Marking…
                  </>
                ) : (
                  <>{graded ? "Mark again" : "Mark answer"}</>
                )}
              </Button>
            </div>

            {errors[question._id] && (
              <p className="mt-3 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#C93C49]">
                {errors[question._id]}
              </p>
            )}

            {graded && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-2xl bg-[#F3FBF7] p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#128A5B]">
                      Examiner marking
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-brand-ink">
                      {score} / {question.marks} marks
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#128A5B]">
                    {scorePercent}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#D7F0E3]">
                  <div
                    className="h-full rounded-full bg-brand-mint"
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink/80">
                  {question.feedback}
                </p>

                <div className="mt-4 space-y-2">
                  <details className="group rounded-2xl bg-white p-3.5">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-brand-ink">
                      Model answer
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink/70">
                      {question.modelAnswer}
                    </p>
                  </details>

                  <details className="group rounded-2xl bg-white p-3.5">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-brand-ink">
                      Mark scheme
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {question.markingGuide.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2 text-sm leading-relaxed text-brand-ink/70"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-lime" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </motion.div>
            )}
          </article>
        );
      })}
    </div>
  );
}
