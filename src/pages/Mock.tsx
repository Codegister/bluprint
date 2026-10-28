import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonRows } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { markLabel, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowRight, Clock, Loader2, Timer, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";

function clock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Timed mock.
 *
 * A paper is assembled from the set up to the board's tariff and sat against a
 * countdown of one minute per mark. Each question is timed, so the report can
 * put "2m 40s on a 4-mark question" beside "2/4" — the pair that tells a student
 * whether they lost the marks or simply ran out of time.
 */
export default function Mock() {
  const { setId } = useParams<{ setId: string }>();
  const valid = Boolean(setId && /^[a-z0-9]{20,40}$/i.test(setId));
  const recent = useQuery(
    api.mocks.recent,
    valid ? { setId: setId as Id<"studySets"> } : "skip",
  );
  const startMock = useMutation(api.mocks.start);
  const finishMock = useMutation(api.mocks.finish);
  const gradeAnswer = useAction(api.ai.gradeExamAnswer);

  const [attemptId, setAttemptId] = useState<Id<"mockAttempts"> | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<Awaited<ReturnType<typeof finishMock>> | null>(
    null,
  );
  const [remaining, setRemaining] = useState(0);

  const attempt = useQuery(
    api.mocks.get,
    attemptId ? { attemptId } : "skip",
  );

  // Per-question stopwatch. A ref, because a tick must not re-render the page.
  const questionSeconds = useRef(0);
  const timings = useRef<Record<string, number>>({});
  const startedAt = useRef<number>(Date.now());
  const deadline = useRef<number>(0);

  const questions = attempt?.questions ?? [];
  const current = questions[index];

  useEffect(() => {
    if (!attempt) return;
    deadline.current = startedAt.current + attempt.attempt.secondsAllowed * 1000;
    setRemaining(attempt.attempt.secondsAllowed);
    const tick = window.setInterval(() => {
      const left = Math.round((deadline.current - Date.now()) / 1000);
      setRemaining(left);
      questionSeconds.current += 1;
      if (current) {
        timings.current[current.examId] = questionSeconds.current;
      }
      if (left <= 0) {
        // Time is up: the paper ends, as it would in the hall.
        window.clearInterval(tick);
        void submit(true);
      }
    }, 1000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.attempt._id ?? null, current?.examId ?? null]);

  const begin = async () => {
    if (!valid) return;
    setStarting(true);
    setError(null);
    try {
      const result = await startMock({ setId: setId as Id<"studySets"> });
      startedAt.current = Date.now();
      questionSeconds.current = 0;
      timings.current = {};
      setIndex(0);
      setReport(null);
      setAttemptId(result.attemptId);
    } catch (startError) {
      setError(readableError(startError, "Could not start the mock."));
    } finally {
      setStarting(false);
    }
  };

  const next = () => {
    if (!current) return;
    timings.current[current.examId] = questionSeconds.current;
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      questionSeconds.current = 0;
    } else {
      void submit(false);
    }
  };

  const submit = async (timedOut: boolean) => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Grade every answered question first, then close the attempt, so the
      // report reads marks that are already saved.
      for (const question of questions) {
        const answer = (answers[question.examId] ?? "").trim();
        if (answer.length < 5) continue;
        try {
          await gradeAnswer({ examId: question.examId, answer });
        } catch {
          // One question failing must not lose the rest of the paper.
        }
      }
      const finished = await finishMock({
        attemptId,
        elapsedSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        timings: Object.entries(timings.current).map(([examId, seconds]) => ({
          examId: examId as Id<"examQuestions">,
          seconds,
        })),
      });
      setAttemptId(null);
      setReport(finished);
      if (timedOut) setError("Time was up, so the paper closed itself.");
    } catch (submitError) {
      setError(readableError(submitError, "Could not finish the mock."));
    } finally {
      setSubmitting(false);
    }
  };

  const urgent = remaining > 0 && remaining <= 60;
  const answeredCount = useMemo(
    () => questions.filter((question) => (answers[question.examId] ?? "").trim().length > 0).length,
    [questions, answers],
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <PageHeader
          title="Timed mock"
          description="A paper assembled from this set to the board's tariff, with one minute per mark. Every question is timed."
          actions={
            <Link
              to={setId ? `/sets/${setId}` : "/tutor#sets"}
              className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline"
            >
              Back to set
            </Link>
          }
        />

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-[#FFF7E6] px-3 py-2 text-xs text-[#7A4B06]">
            {error}
          </p>
        )}

        {!attempt && !report && (
          <section className="gizmo-card mt-4 p-5 sm:p-6">
            <p className="text-sm leading-relaxed text-brand-ink/80">
              The paper is built from the written questions in this set, up to 100
              marks. If the set is shorter than that, the mock is shorter too — it
              never invents questions to fill the tariff.
            </p>
            <Button
              onClick={() => void begin()}
              disabled={starting || !valid}
              className="mt-4 h-10 rounded-full px-5 text-sm font-semibold"
            >
              {starting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Timer className="size-4" aria-hidden />}
              Start the mock
            </Button>

            <div className="mt-6">
              <p className="text-xs font-semibold text-brand-ink">Previous mocks</p>
              {recent === undefined ? (
                <div className="mt-2">
                  <SkeletonRows rows={2} />
                </div>
              ) : recent.length === 0 ? (
                <p className="mt-1 text-[0.8rem] text-muted-foreground">None yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {recent.map((row) => (
                    <li
                      key={row._id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2 text-[0.78rem]"
                    >
                      <span className="text-brand-ink/80">
                        {new Date(row.startedAt).toLocaleDateString()} ·{" "}
                        {plural(row.totalMarks, "mark")}
                      </span>
                      <span className="font-semibold tabular-nums text-brand-ink">
                        {row.earnedMarks === null
                          ? "In progress"
                          : `${row.earnedMarks}/${row.totalMarks}`}
                        {row.elapsedSeconds !== null
                          ? ` · ${clock(row.elapsedSeconds)} of ${clock(row.secondsAllowed)}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {attempt && current && (
          <section className="gizmo-card mt-4 overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
              <p className="text-[0.78rem] font-semibold text-brand-ink">
                Question {index + 1} of {questions.length} · {markLabel(current.marks)}
              </p>
              <p
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.78rem] font-bold tabular-nums",
                  urgent ? "bg-[#FFEEF0] text-[#A81F28]" : "bg-brand-panel text-brand-ink",
                )}
                aria-live="polite"
              >
                <Clock className="size-3.5" aria-hidden />
                {clock(remaining)}
              </p>
            </header>

            <div className="px-4 py-4 sm:px-5">
              <p className="font-display text-[1.05rem] font-bold leading-snug text-brand-ink">
                {current.question}
              </p>
              <Textarea
                value={answers[current.examId] ?? ""}
                onChange={(event) =>
                  setAnswers((currentAnswers) => ({
                    ...currentAnswers,
                    [current.examId]: event.target.value,
                  }))
                }
                rows={7}
                placeholder="Answer as you would in the exam. The clock keeps running."
                className="mt-3 bg-white text-sm"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.72rem] text-muted-foreground">
                  {answeredCount} of {plural(questions.length, "question")} answered ·{" "}
                  {clock(questionSeconds.current)} on this one
                </p>
                <Button
                  onClick={next}
                  disabled={submitting}
                  className="h-10 rounded-full px-5 text-sm font-semibold"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  {index + 1 < questions.length ? "Next question" : "Finish and mark"}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </section>
        )}

        {report && (
          <section className="gizmo-card mt-4 p-5 sm:p-6">
            <p className="font-display text-[1.1rem] font-bold text-brand-ink">
              {report.earnedMarks} of {markLabel(report.totalMarks)} ·{" "}
              {clock(report.secondsUsed)} used of {clock(report.secondsAllowed)}
            </p>
            <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">
              Time per mark is beside each question. Anything much over a minute a
              mark is where the clock cost you marks.
            </p>
            <ul className="mt-3 space-y-1.5">
              {report.secondsPerMark.map((row, rowIndex) => (
                <li
                  key={row.examId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2 text-[0.78rem]"
                >
                  <span className="text-brand-ink/80">Question {rowIndex + 1}</span>
                  <span className="tabular-nums text-brand-ink">
                    {report.rows[rowIndex]?.awardedMarks ?? "—"}/{row.marks} marks ·{" "}
                    {clock(row.seconds)} · {row.perMark}s per mark
                  </span>
                </li>
              ))}
            </ul>
            {report.rows.some((row) => row.awardedMarks === null) && (
              <p className="mt-2 inline-flex items-start gap-1.5 text-[0.74rem] text-[#7A4B06]">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Unanswered questions are not marked, so the total only counts what
                you wrote.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => void begin()}
                className="h-10 rounded-full px-5 text-sm font-semibold"
              >
                Sit another
              </Button>
              <Link
                to={`/sets/${setId}`}
                className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold text-brand-ink/80 hover:bg-brand-panel"
              >
                Back to set
              </Link>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
