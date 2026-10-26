import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { boardFamily, markNotation, questionTotalLine } from "@/convex/lib/paperFormat";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PaperCover = NonNullable<Doc<"pastPapers">["cover"]>;
type PaperQuestion = Doc<"pastPaperQuestions">;

/**
 * Sits a saved past paper question by question.
 *
 * The paper is laid out to read like the real thing: the board's cover rubric at
 * the top, its section headings, its question numbering and its mark notation.
 * Each answer is marked against the paper's own mark scheme by the same examiner
 * prompt as a study set's exam questions, so the score is deliberately strict.
 * The model answer and marking guide stay hidden until grading, which keeps the
 * attempt honest.
 */
export function PastPaperPractice({
  questions,
  qualification,
  examBoard,
  cover,
}: {
  questions: PaperQuestion[];
  qualification?: string;
  examBoard?: string;
  cover?: PaperCover | null;
}) {
  const gradeAnswer = useAction(api.ai.gradePastPaperAnswer);
  const family = boardFamily(examBoard);
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

  // Consecutive questions that share a section are rendered under one heading,
  // which is how a real paper groups Section A and Section B. Papers built
  // before the layout was stored have no section, and render as one flat list.
  const sections: Array<{
    title?: string;
    instruction?: string;
    items: PaperQuestion[];
  }> = [];
  for (const question of questions) {
    const title = question.section?.trim() || undefined;
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.items.push(question);
      if (!last.instruction && question.sectionInstruction) {
        last.instruction = question.sectionInstruction;
      }
      continue;
    }
    sections.push({
      title,
      instruction: question.sectionInstruction,
      items: [question],
    });
  }

  const handleMark = async (question: PaperQuestion) => {
    const answer = (answers[question._id] ?? "").trim();
    // An essay needs a few sentences before an examiner can place it in a
    // level, and a one-mark multiple-choice question can be answered with a
    // single letter.
    const minimum = question.marks >= 20 ? 120 : question.marks <= 2 ? 1 : 15;
    if (answer.length < minimum) {
      setErrors((current) => ({
        ...current,
        [question._id]:
          minimum > 15
            ? "Write a few sentences before sending this essay for marking."
            : "Write a fuller answer before sending it for grading.",
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

  let questionNumber = 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {cover && <PaperCoverPage cover={cover} />}

      <div className="rounded-[1.6rem] border border-border bg-white p-5">
        <p className="font-display text-base font-bold text-brand-ink">
          Attempt the paper, then mark each answer
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {qualification ? `Marked using ${qualification} conventions. ` : ""}
          Write a full answer for each question before marking it. The model
          answer and mark scheme unlock after marking, so the score is what an
          examiner would give, not what looks familiar.
        </p>
      </div>

      {sections.map((section, sectionIndex) => (
        <div key={section.title ?? `section-${sectionIndex}`} className="space-y-4">
          {section.title && (
            <div className="rounded-[1.4rem] border border-[#E3E4EC] bg-brand-panel px-5 py-4">
              <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.08em] text-brand-ink">
                {section.title}
              </p>
              {section.instruction && (
                <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground">
                  {section.instruction}
                </p>
              )}
            </div>
          )}

          {section.items.map((question) => {
            questionNumber += 1;
            const position = questionNumber;
            const answer = answers[question._id] ?? "";
            const isGrading = gradingId === question._id;
            const graded =
              question.awardedMarks !== undefined && Boolean(question.feedback);
            const score = question.awardedMarks ?? 0;
            const scorePercent = question.marks
              ? Math.round((score / question.marks) * 100)
              : 0;
            const wordCount = answer.trim()
              ? answer.trim().split(/\s+/).length
              : 0;
            // Essays and long responses need a bigger box and essay guidance;
            // a short-answer question keeps the compact layout.
            const isEssay = question.marking === "levels" && question.marks >= 20;
            const isExtended =
              question.marking === "levels" || question.marks >= 12;
            const totalLine = questionTotalLine(
              family,
              question.label?.replace(/\s*\(.*\)$/, "") || String(position),
              question.marks,
            );

            return (
              <article
                key={question._id}
                className="rounded-[1.6rem] border border-border bg-white p-5 sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Question {position} of {questions.length}
                  </span>
                  <div className="flex items-center gap-2">
                    {graded && (
                      <span className="rounded-full bg-[#E9FBF3] px-3 py-1 text-xs font-semibold text-[#128A5B]">
                        {score}/{question.marks}
                      </span>
                    )}
                    <span className="rounded-full bg-brand-panel px-3 py-1 text-xs font-semibold text-brand-ink/70">
                      {markNotation(family, question.marks)}
                    </span>
                  </div>
                </div>

                {/* The number sits in its own column, the way a printed paper
                    sets the question number out in the margin. */}
                <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-4">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-8 w-14 place-items-center rounded-lg bg-[#F4F2FF] font-display text-[0.82rem] font-bold text-[#5B3DF5]"
                  >
                    {question.label?.trim() || position}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[1.1rem] font-bold leading-snug text-brand-ink sm:text-[1.22rem]">
                      {question.question}
                    </p>

                    {(question.commandWord || question.specReference) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {question.commandWord && (
                          <span className="rounded-full bg-[#F1F0FB] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[#5B3DF5]">
                            {question.commandWord}
                          </span>
                        )}
                        {question.specReference && (
                          <span className="rounded-full bg-brand-panel px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground">
                            Spec {question.specReference}
                          </span>
                        )}
                        {question.marking === "levels" && (
                          <span className="rounded-full bg-[#E9FBF3] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[#128A5B]">
                            Levels-marked
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Textarea
                  value={answer}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [question._id]: event.target.value,
                    }))
                  }
                  placeholder={
                    isEssay
                      ? "Write your essay here…"
                      : "Write your answer here…"
                  }
                  rows={isEssay ? 16 : isExtended ? 10 : 6}
                  maxLength={12000}
                  disabled={isGrading}
                  className={cn(
                    "mt-4 resize-y rounded-2xl border-border bg-white text-sm leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/60 focus-visible:border-[#B9A6FF] focus-visible:ring-[#7C5CFF]/15",
                    isEssay
                      ? "min-h-[320px]"
                      : isExtended
                        ? "min-h-[220px]"
                        : "min-h-[140px]",
                  )}
                />

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isEssay
                      ? `${wordCount} words · write a full essay with a clear argument`
                      : isExtended
                        ? `${wordCount} words · build a developed answer`
                        : question.marks <= 2
                          ? `${answer.trim().length} characters · a short answer is enough`
                          : `${answer.trim().length} characters · aim for ${question.marks} clear point${question.marks === 1 ? "" : "s"}`}
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

                {/* Edexcel, OCR and Cambridge print a running total after each
                    question; AQA does not, so this stays hidden for those. */}
                {totalLine && (
                  <p className="mt-3 border-t border-dashed border-border pt-2 text-right text-[0.72rem] font-semibold text-muted-foreground">
                    {totalLine}
                  </p>
                )}

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
      ))}

      <p className="pb-2 text-center text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        End of paper
      </p>
    </div>
  );
}

/**
 * The cover, set out the way the board prints one: the qualification and paper
 * label at the top, then the Materials / Instructions / Information / Advice
 * blocks. It is kept visually distinct from the questions so it reads as a front
 * page rather than another question card.
 */
function PaperCoverPage({ cover }: { cover: PaperCover }) {
  const blocks: Array<{ title: string; items: string[] }> = [
    { title: "Materials", items: cover.materials },
    { title: "Instructions", items: cover.instructions },
    { title: "Information", items: cover.information },
    { title: "Advice", items: cover.advice },
  ].filter((block) => block.items.length > 0);

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-[#E3E4EC] bg-[#FCFCFD]">
      <div className="border-b border-[#E3E4EC] bg-white px-5 py-6 text-center sm:px-8 sm:py-8">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#5B3DF5]">
          {cover.qualification}
        </p>
        <h2 className="mt-2 font-display text-[1.5rem] font-bold uppercase tracking-[0.02em] text-brand-ink sm:text-[1.8rem]">
          {cover.paperLabel}
        </h2>
        <p className="mt-1 text-[0.85rem] font-semibold text-brand-ink/70">
          Time allowed: {cover.timeAllowed}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[0.75rem] font-semibold text-muted-foreground">
          <span className="rounded-full bg-brand-panel px-3 py-1">
            Total marks: {cover.totalMarks}
          </span>
          <span className="rounded-full bg-brand-panel px-3 py-1">
            Answer all questions
          </span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-8 sm:py-6">
        {blocks.map((block) => (
          <div key={block.title}>
            <p className="font-display text-[0.86rem] font-bold uppercase tracking-[0.08em] text-brand-ink">
              {block.title}
            </p>
            <ul className="mt-1.5 space-y-1">
              {block.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[0.84rem] leading-relaxed text-brand-ink/75"
                >
                  <span className="mt-[0.42rem] size-1.5 shrink-0 rounded-full bg-[#B9A6FF]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="rounded-2xl bg-[#FFFBF2] px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-[#8A5A12]">
          Practice mock — not an official examination paper. Written from your
          course specification in this board's paper format.
        </p>
      </div>
    </section>
  );
}
