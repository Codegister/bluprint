import { Meter } from "@/components/motion/Motion";
import { predictGrade } from "@/convex/lib/gradeBoundaries";
import { markLabel, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CalendarClock,
  Gauge,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router";

export type ReadinessView = {
  score: number;
  band: "early" | "building" | "on-track" | "exam-ready";
  parts: {
    recall: number;
    quiz: number | null;
    exam: number | null;
  };
  inputs: {
    cardsSettled: number;
    cardsTotal: number;
    quizCorrect: number;
    quizTotal: number;
    examEarned: number;
    examTotal: number;
  };
  weights: { recall: number; quiz: number; exam: number };
};

export type PaceView = {
  examDate: string;
  daysLeft: number;
  remaining: number;
  perDay: number;
  quizPerWeek: number;
  status: "on-track" | "tight" | "behind" | "done" | "past";
  projected: number;
  target: number;
};

const BAND_COPY: Record<ReadinessView["band"], string> = {
  early: "Early days — keep the deck moving.",
  building: "Building. The core is there, the edges are not.",
  "on-track": "On track for a solid grade.",
  "exam-ready": "Exam-ready. Protect it with short reviews.",
};

const PACE_STYLE: Record<PaceView["status"], string> = {
  "on-track": "bg-[#E9FBF3] text-[#0B6B45]",
  tight: "bg-[#FFF6E5] text-[#96650A]",
  behind: "bg-[#FFEEF0] text-[#A81F28]",
  done: "bg-[#E9FBF3] text-[#0B6B45]",
  past: "bg-brand-panel text-muted-foreground",
};

const PACE_LABEL: Record<PaceView["status"], string> = {
  "on-track": "On track",
  tight: "Tight",
  behind: "Behind",
  done: "Ready",
  past: "Exam passed",
};

function shortDate(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function PartMeter({
  label,
  value,
  tint,
}: {
  label: string;
  value: number | null;
  tint: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.72rem] font-medium text-brand-ink/65">{label}</span>
        <span className="text-[0.72rem] font-semibold tabular-nums text-brand-ink/80">
          {value === null ? "—" : `${value}%`}
        </span>
      </div>
      <Meter
        value={value ?? 0}
        className="mt-1 h-1.5 bg-brand-panel"
        barClassName={tint}
        label={label}
      />
    </div>
  );
}

/**
 * Two answers on the set overview: how ready the material actually is, and
 * what has to happen each day between now and the exam.
 */
export function ReadinessPanel({
  setId,
  readiness,
  projected,
  pace,
  weakCardCount,
  weakQuizCount,
  dueCount,
  examBoard,
}: {
  setId: string;
  readiness: ReadinessView;
  projected: ReadinessView;
  pace: PaceView | null;
  weakCardCount: number;
  weakQuizCount: number;
  dueCount: number;
  examBoard?: string;
}) {
  // The percentage as a 9–1 grade, always with its band and the date of the
  // boundary table it came from: a single number would imply a precision the
  // boundaries do not have.
  const prediction = predictGrade(readiness.score, examBoard);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-[2rem] border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mono-label text-chrome-7">Mastery</p>
            <h2 className="mt-1 font-display text-[1.05rem] font-bold text-brand-ink">
              Exam readiness
            </h2>
          </div>
          <span className="grid size-9 place-items-center rounded-xl bg-brand-panel text-chrome-7">
            <ShieldCheck className="size-4" aria-hidden />
          </span>
        </div>

        <div className="mt-3 flex items-end gap-2">
          <p className="font-display text-[2.4rem] font-extrabold leading-none tabular-nums text-brand-ink">
            {readiness.score}
            <span className="text-[1.1rem] font-bold text-muted-foreground">%</span>
          </p>
          <p className="pb-1 text-[0.78rem] font-semibold text-[#0B6B45]">
            {readiness.band === "exam-ready"
              ? "Exam-ready"
              : readiness.band === "on-track"
                ? "On track"
                : readiness.band === "building"
                  ? "Building"
                  : "Early days"}
          </p>
        </div>
        <p className="mt-1 text-[0.78rem] leading-relaxed text-muted-foreground">
          {BAND_COPY[readiness.band]}
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white px-3.5 py-2.5">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Predicted grade
            </p>
            <p className="font-display text-[1.5rem] font-extrabold leading-none tabular-nums text-brand-ink">
              {prediction.label}
            </p>
          </div>
          <p className="pb-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
            {prediction.label === "—"
              ? prediction.bandLabel
              : `Band ${prediction.bandLabel} on ${prediction.board} boundaries`}
            {prediction.nextGrade
              ? ` · ${prediction.nextGrade.percentAway} points from a ${prediction.nextGrade.grade}`
              : ""}
          </p>
        </div>
        <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
          Indicative only: {prediction.board} boundaries from {prediction.series},
          last checked {prediction.updatedAt}. Real boundaries differ by subject and
          move each series.
        </p>

        <div className="mt-4 space-y-2.5">
          <PartMeter label="Card recall" value={readiness.parts.recall} tint="bg-chrome-6" />
          <PartMeter label="Quiz accuracy" value={readiness.parts.quiz} tint="bg-chrome-4" />
          <PartMeter label="Written marks" value={readiness.parts.exam} tint="bg-[#F0A03C]" />
        </div>

        {/* The number above is a weighted average. This is the working: what
            each part is measured from, and how much of the total it carries. */}
        <details className="group mt-3 rounded-xl bg-brand-panel/70 px-3 py-2">
          <summary className="cursor-pointer list-none text-[0.72rem] font-semibold text-brand-ink/70">
            How this is worked out
            <span className="ml-1 font-normal text-muted-foreground group-open:hidden">
              — {readiness.weights.recall}% recall · {readiness.weights.quiz}% quiz ·{" "}
              {readiness.weights.exam}% written
            </span>
          </summary>
          <ul className="mt-2 space-y-1 text-[0.72rem] leading-relaxed text-brand-ink/70">
            <li>
              <span className="font-semibold tabular-nums">{readiness.parts.recall}%</span>{" "}
              card recall — {readiness.inputs.cardsSettled} of{" "}
              {plural(readiness.inputs.cardsTotal, "card")} marked known, remembered
              at their review interval. Weight {readiness.weights.recall}%.
            </li>
            <li>
              {readiness.parts.quiz === null ? (
                <>No quiz taken yet, so its weight is shared out across the rest.</>
              ) : (
                <>
                  <span className="font-semibold tabular-nums">{readiness.parts.quiz}%</span>{" "}
                  quiz accuracy — {readiness.inputs.quizCorrect} of{" "}
                  {plural(readiness.inputs.quizTotal, "answer")} on the last quiz. Weight{" "}
                  {readiness.weights.quiz}%.
                </>
              )}
            </li>
            <li>
              {readiness.parts.exam === null ? (
                <>No written answer marked yet, so its weight is shared out too.</>
              ) : (
                <>
                  <span className="font-semibold tabular-nums">{readiness.parts.exam}%</span>{" "}
                  written marks — {readiness.inputs.examEarned} of{" "}
                  {markLabel(readiness.inputs.examTotal)} credited on marked
                  questions. Weight {readiness.weights.exam}%.
                </>
              )}
            </li>
          </ul>
        </details>

        <p className="mt-4 rounded-xl bg-brand-panel/70 px-3 py-2 text-[0.72rem] leading-relaxed text-brand-ink/65">
          {pace
            ? `Projected readiness on exam day: ${projected.score}% if nothing else changes. Each review pushes that up.`
            : "Add an exam date in set settings to see where this deck will be on the day."}
        </p>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mono-label text-chrome-7">Pace</p>
            <h2 className="mt-1 font-display text-[1.05rem] font-bold text-brand-ink">
              {pace ? `Plan to ${shortDate(pace.examDate)}` : "Exam pace plan"}
            </h2>
          </div>
          <span className="grid size-9 place-items-center rounded-xl bg-[#FFF1DE] text-[#8A5410]">
            <CalendarClock className="size-4" aria-hidden />
          </span>
        </div>

        {pace ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold",
                  PACE_STYLE[pace.status],
                )}
              >
                {PACE_LABEL[pace.status]}
              </span>
              <span className="text-[0.75rem] font-medium text-muted-foreground">
                {pace.daysLeft} day{pace.daysLeft === 1 ? "" : "s"} left
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-brand-panel/60 p-3">
                <p className="font-display text-lg font-bold tabular-nums text-brand-ink">
                  {pace.perDay}
                </p>
                <p className="mt-0.5 text-[0.66rem] font-medium text-muted-foreground">
                  cards / day
                </p>
              </div>
              <div className="rounded-2xl bg-brand-panel/60 p-3">
                <p className="font-display text-lg font-bold tabular-nums text-brand-ink">
                  {pace.quizPerWeek}
                </p>
                <p className="mt-0.5 text-[0.66rem] font-medium text-muted-foreground">
                  quiz / week
                </p>
              </div>
              <div className="rounded-2xl bg-brand-panel/60 p-3">
                <p className="font-display text-lg font-bold tabular-nums text-brand-ink">
                  {pace.projected}%
                </p>
                <p className="mt-0.5 text-[0.66rem] font-medium text-muted-foreground">
                  at exam
                </p>
              </div>
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[0.74rem] leading-relaxed text-muted-foreground">
              <Gauge className="mt-0.5 size-3.5 shrink-0 text-chrome-7" aria-hidden />
              {pace.remaining === 0
                ? "Every card is consolidated. Keep it warm with short reviews."
                : `${plural(pace.remaining, "card")} not yet settled. About ${plural(pace.perDay, "card")} a day clears them before the paper.`}
            </p>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border p-4">
            <p className="text-[0.82rem] leading-relaxed text-brand-ink/75">
              Give this set an exam date and Bluprint turns it into a per-day
              plan, a projected readiness for the day, and a daily goal that
              follows the date.
            </p>
            <p className="mt-2 text-[0.74rem] font-medium text-muted-foreground">
              Open <span className="font-semibold text-brand-ink">Edit set</span>{" "}
              from the set&apos;s menu to add it.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Link
            to={`/sets/${setId}/weak`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.76rem] font-semibold transition-colors",
              weakCardCount + weakQuizCount > 0
                ? "bg-[#FFEEF0] text-[#A81F28] hover:bg-[#FFE3E6]"
                : "border border-border bg-white text-brand-ink/60 hover:bg-brand-panel",
            )}
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            Weak spots
            <span className="tabular-nums">
              {weakCardCount + weakQuizCount}
            </span>
          </Link>
          <Link
            to={`/sets/${setId}/cards`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-brand-ink/75 transition-colors hover:bg-brand-panel"
          >
            {dueCount} due now
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
