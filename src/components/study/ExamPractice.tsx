import { ExplainDialog } from "@/components/study/ExplainDialog";
import { EASE } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  criteriaFor,
  feedbackSummary,
} from "@/convex/lib/markingCriteria";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ExamPractice({
  exams,
  setId,
  qualification,
}: {
  exams: Doc<"examQuestions">[];
  setId: Id<"studySets">;
  qualification?: string;
}) {
  const gradeAnswer = useAction(api.ai.gradeExamAnswer);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(exams.map((exam) => [exam._id, exam.userAnswer ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  if (exams.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="gizmo-card p-10 text-center"
      >
        <p className="text-sm text-muted-foreground">
          This set has no exam questions yet.
        </p>
      </motion.div>
    );
  }

  const handleMark = async (exam: Doc<"examQuestions">) => {
    const answer = (answers[exam._id] ?? "").trim();
    if (answer.length < 15) {
      setErrors((current) => ({
        ...current,
        [exam._id]: "Write a fuller answer before sending it for grading.",
      }));
      return;
    }

    setErrors((current) => ({ ...current, [exam._id]: "" }));
    setGradingId(exam._id);
    try {
      const result = await gradeAnswer({ examId: exam._id, answer });
      toast.success(`Graded: ${result.awardedMarks}/${result.marks}`);
    } catch (error) {
      const message = readableError(error, "Could not grade that answer.");
      setErrors((current) => ({ ...current, [exam._id]: message }));
      toast.error(message);
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="rise-stagger mx-auto w-full max-w-3xl space-y-4">
      <div className="gizmo-card p-5">
        <div>
          <p className="font-display text-base font-bold text-brand-ink">
            Exam practice, marked by AI
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {qualification
              ? `Written and marked using ${qualification} conventions. `
              : ""}
            Write a full answer. Bluprint marks it against the guide and saves the
            result. Model answers unlock after grading.
          </p>
        </div>
      </div>

      {exams.map((exam, index) => {
        const answer = answers[exam._id] ?? "";
        const isGrading = gradingId === exam._id;
        const graded = exam.awardedMarks !== undefined && exam.feedback;
        const score = exam.awardedMarks ?? 0;
        const scorePercent = exam.marks ? Math.round((score / exam.marks) * 100) : 0;
        // One row per mark-scheme criterion, in the guide's order. The
        // checklist carries the verdict and the quote for each row.
        const criteria = criteriaFor(exam);

        return (
          <article key={exam._id} className="gizmo-card p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Question {index + 1}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Available before writing, so it can help plan the answer;
                    the model answer is only sent once grading has revealed it. */}
                <ExplainDialog
                  setId={setId}
                  qualification={qualification}
                  context={{
                    kind: "exam",
                    question: exam.question,
                    marks: exam.marks,
                    markingGuide: exam.markingGuide,
                    studentAnswer: answer.trim() || undefined,
                    ...(graded ? { correctAnswer: exam.modelAnswer } : {}),
                  }}
                />
                <span className="rounded-full bg-brand-panel px-3 py-1 text-xs font-semibold text-brand-ink/70">
                  {exam.marks} marks
                </span>
                {graded && (
                  <span className="rounded-full bg-[#E9FBF3] px-3 py-1 text-xs font-semibold text-[#0B6B45]">
                    {score}/{exam.marks}
                  </span>
                )}
              </div>
            </div>

            <p className="mt-3 font-display text-[1.1rem] font-bold leading-snug text-brand-ink sm:text-[1.25rem]">
              {exam.question}
            </p>

            <Textarea
              value={answer}
              onChange={(event) =>
                setAnswers((current) => ({ ...current, [exam._id]: event.target.value }))
              }
              placeholder="Write your answer here…"
              rows={6}
              maxLength={5000}
              disabled={isGrading}
              className="mt-4 min-h-[140px] resize-y rounded-2xl border-border bg-white text-sm leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/90 focus-visible:border-chrome-6 focus-visible:ring-chrome-6/15"
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {answer.trim().length} characters · aim for {exam.marks} clear points
              </p>
              <Button
                onClick={() => handleMark(exam)}
                disabled={isGrading}
                className={cn(
                  "h-10 rounded-full px-5 text-sm font-semibold sm:w-auto",
                  graded
                    ? "bg-[#E9FBF3] text-[#0B6B45] hover:bg-[#DDF7EB]"
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

            {errors[exam._id] && (
              <motion.p
                key={errors[exam._id]}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="mt-3 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#A81F28]"
              >
                {errors[exam._id]}
              </motion.p>
            )}

            {graded && (
              <motion.div
                key={`${exam._id}-${score}-${exam.awardedMarks !== undefined}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="mt-4 rounded-2xl bg-[#F3FBF7] p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#0B6B45]">
                      AI grading
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-brand-ink">
                      {score} / {exam.marks} marks
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#0B6B45]">
                    {scorePercent}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#D7F0E3]">
                  <motion.div
                    className="h-full rounded-full bg-brand-mint"
                    initial={{ width: 0 }}
                    animate={{ width: `${scorePercent}%` }}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
                  />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink/80">
                  {feedbackSummary(exam.feedback ?? "")}
                </p>

                {/* The mark as a checklist against the guide: one row per
                    criterion, its full text, and the student's quoted words. */}
                {criteria.length > 0 && (exam.checklist?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-brand-ink">
                      Awarded marks, criterion by criterion
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {criteria.map((criterion, index) => {
                        const check = exam.checklist?.[index];
                        const awarded = check?.awarded ?? 0;
                        const evidence = check?.evidence;
                        return (
                          <div
                            key={criterion.id}
                            className={cn(
                              "flex items-start gap-2 rounded-2xl border p-3 text-[0.8rem] leading-relaxed",
                              awarded > 0
                                ? "border-[#CFE7DC] bg-[#F3FBF7]"
                                : "border-border bg-white",
                            )}
                          >
                            {awarded > 0 ? (
                              <Check
                                className="mt-0.5 size-4 shrink-0 text-[#0B6B45]"
                                aria-hidden
                              />
                            ) : (
                              <X
                                className="mt-0.5 size-4 shrink-0 text-[#A81F28]"
                                aria-hidden
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-semibold text-brand-ink">
                                  {criterion.text}
                                </p>
                                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.68rem] font-semibold tabular-nums text-brand-ink/70">
                                  {awarded}/{criterion.marks} marks
                                </span>
                              </div>
                              <p className="mt-1 text-muted-foreground">
                                {awarded > 0
                                  ? evidence && evidence !== "absent"
                                    ? `Your words: “${evidence}”`
                                    : "Credited from your answer."
                                  : evidence && evidence !== "absent"
                                    ? `You wrote “${evidence}”, which is not a creditable statement of this point.`
                                    : "Absent: nothing in your answer states this point."}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <details className="group rounded-2xl bg-white p-3.5">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-brand-ink">
                      Model answer
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink/70">
                      {exam.modelAnswer}
                    </p>
                  </details>

                  {(exam.checklist?.length ?? 0) === 0 && (
                    <details className="group rounded-2xl bg-white p-3.5">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-brand-ink">
                        Marking guide
                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {criteria.map((criterion) => (
                          <li
                            key={criterion.id}
                            className="flex items-start gap-2 text-sm leading-relaxed text-brand-ink/70"
                          >
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-lime" />
                            {criterion.text}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </motion.div>
            )}
          </article>
        );
      })}
    </div>
  );
}
