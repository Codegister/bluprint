import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ExamPractice({
  exams,
  qualification,
}: {
  exams: Doc<"examQuestions">[];
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
      <div className="gizmo-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          This set has no exam questions yet.
        </p>
      </div>
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
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="gizmo-card flex items-start gap-3.5 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E9F0FF] text-[#3B82F6]">
          <PenLine className="size-4" />
        </span>
        <div>
          <p className="font-display text-base font-bold text-brand-ink">
            Exam practice, marked by AI
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {qualification
              ? `Written and marked using ${qualification} conventions. `
              : ""}
            Write a full answer. Bluprint marks it against the guide and saves the
            result — model answers unlock after grading.
          </p>
        </div>
      </div>

      {exams.map((exam, index) => {
        const answer = answers[exam._id] ?? "";
        const isGrading = gradingId === exam._id;
        const graded = exam.awardedMarks !== undefined && exam.feedback;
        const score = exam.awardedMarks ?? 0;
        const scorePercent = exam.marks ? Math.round((score / exam.marks) * 100) : 0;

        return (
          <article key={exam._id} className="gizmo-card p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Question {index + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-panel px-3 py-1 text-xs font-semibold text-brand-ink/70">
                  {exam.marks} marks
                </span>
                {graded && (
                  <span className="rounded-full bg-[#E9FBF3] px-3 py-1 text-xs font-semibold text-[#128A5B]">
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
              className="mt-4 min-h-[140px] resize-y rounded-2xl border-border bg-white text-sm leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/60 focus-visible:border-[#B9A6FF] focus-visible:ring-[#7C5CFF]/15"
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
                  <>
                    <Sparkles className="size-4" />
                    {graded ? "Mark again" : "Mark answer"}
                  </>
                )}
              </Button>
            </div>

            {errors[exam._id] && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#C93C49]">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {errors[exam._id]}
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
                      AI grading
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-brand-ink">
                      {score} / {exam.marks} marks
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
                  {exam.feedback}
                </p>

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

                  <details className="group rounded-2xl bg-white p-3.5">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-brand-ink">
                      Marking guide
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {exam.markingGuide.map((point) => (
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
