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

export function ExamPractice({ exams }: { exams: Doc<"examQuestions">[] }) {
  const gradeAnswer = useAction(api.ai.gradeExamAnswer);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(exams.map((exam) => [exam._id, exam.userAnswer ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  if (exams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-[12px] text-muted-foreground">
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
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <span className="grid size-8 shrink-0 place-items-center rounded border border-brand-sky/25 bg-brand-sky/10 text-brand-sky">
          <PenLine className="size-3.5" />
        </span>
        <div>
          <p className="mono-label text-brand-sky">EXAM PRACTICE / AI GRADED</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Write a full answer. Bluprint grades it against the marking guide and saves the
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

        return (
          <article
            key={exam._id}
            className="rounded-xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="mono-label text-muted-foreground">
                QUESTION {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="rounded border border-border bg-brand-panel px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-muted-foreground">
                  {exam.marks} MARKS
                </span>
                {graded && (
                  <span className="rounded border border-brand-mint/20 bg-brand-mint/[0.06] px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-brand-mint">
                    {score}/{exam.marks}
                  </span>
                )}
              </div>
            </div>

            <p className="mt-3 font-display text-[1.1rem] font-medium leading-snug text-brand-ink sm:text-[1.25rem]">
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
              className="mt-4 min-h-[130px] resize-y rounded-md border-border bg-brand-panel text-[12.5px] leading-relaxed text-brand-ink placeholder:text-muted-foreground/60"
            />

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-[9px] tracking-wide text-muted-foreground/70">
                {answer.trim().length} CHARS / AIM FOR {exam.marks} CLEAR POINTS
              </p>
              <Button
                onClick={() => handleMark(exam)}
                disabled={isGrading}
                className={cn(
                  "h-9 rounded-md px-4 font-mono text-[10px] font-medium tracking-wide",
                  graded
                    ? "border border-brand-mint/30 bg-brand-mint/10 text-brand-mint hover:bg-brand-mint/15"
                    : "bg-brand-pink text-brand-void hover:bg-brand-pink-deep",
                )}
              >
                {isGrading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    GRADING WITH NVIDIA…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    {graded ? "GRADE AGAIN" : "GRADE ANSWER"}
                  </>
                )}
              </Button>
            </div>

            {errors[exam._id] && (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {errors[exam._id]}
              </p>
            )}

            {graded && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg border border-border bg-brand-panel p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="mono-label text-muted-foreground">AI GRADING</p>
                    <p className="mt-1 font-display text-lg font-semibold text-brand-ink">
                      {score} / {exam.marks} marks
                    </p>
                  </div>
                  <span className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[9px] tracking-wide text-muted-foreground">
                    {scorePercent}%
                  </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-brand-mint"
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-brand-ink/75">
                  {exam.feedback}
                </p>

                <div className="mt-4 space-y-2">
                  <details className="group rounded-md border border-border bg-background p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[9.5px] tracking-wide text-muted-foreground">
                      MODEL ANSWER
                      <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-brand-ink/70">
                      {exam.modelAnswer}
                    </p>
                  </details>

                  <details className="group rounded-md border border-border bg-background p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[9.5px] tracking-wide text-muted-foreground">
                      MARKING GUIDE
                      <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {exam.markingGuide.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2 text-[11.5px] leading-relaxed text-brand-ink/70"
                        >
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-lime/70" />
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
