import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Check, CircleDashed } from "lucide-react";

/**
 * "X of Y spec points covered" for one set, with the statements that have
 * nothing behind them listed underneath. Tags are assigned at build time by
 * matching each card and question to the topic's specification statements, so
 * this is a real count rather than an estimate.
 */
export function SpecCoveragePanel({ setId }: { setId: Id<"studySets"> }) {
  const data = useQuery(api.coverage.forSet, { setId });

  if (data === undefined) {
    return <Skeleton className="h-24 w-full rounded-2xl" />;
  }
  if (!data || data.unmapped) {
    return (
      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-[0.86rem] font-semibold text-brand-ink">
          Specification coverage
        </summary>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-muted-foreground">
          This set was built from pasted notes, so there is no specification to map
          it to. Build a set from a course topic to see coverage.
        </p>
      </details>
    );
  }

  const { coverage } = data;
  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
        <span className="text-[0.86rem] font-semibold text-brand-ink">
          Specification coverage
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold tabular-nums",
            coverage.percent >= 70
              ? "bg-[#E9FBF3] text-[#0B6B45]"
              : coverage.percent >= 40
                ? "bg-[#FFF6E5] text-[#96650A]"
                : "bg-[#FFEEF0] text-[#A81F28]",
          )}
        >
          {coverage.covered.length} of {plural(coverage.total, "spec point")} ·{" "}
          {coverage.percent}%
        </span>
      </summary>

      <p className="mt-2 text-[0.76rem] leading-relaxed text-muted-foreground">
        Each card and question is matched to the specification statement it
        teaches. {data.tagged.cards} of {data.tagged.cardsTotal} cards,{" "}
        {data.tagged.quiz} of {data.tagged.quizTotal} quiz questions and{" "}
        {data.tagged.exam} of {data.tagged.examTotal} written questions carry a tag.
      </p>

      <ul className="mt-2 space-y-1">
        {coverage.covered.map((point) => (
          <li
            key={point.id}
            className="flex items-start gap-2 rounded-xl bg-[#F3FBF7] px-2.5 py-1.5 text-[0.76rem] leading-relaxed text-brand-ink/80"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-[#0B6B45]" aria-hidden />
            {point.text}
          </li>
        ))}
        {coverage.uncovered.map((point) => (
          <li
            key={point.id}
            className="flex items-start gap-2 rounded-xl bg-brand-panel/60 px-2.5 py-1.5 text-[0.76rem] leading-relaxed text-muted-foreground"
          >
            <CircleDashed className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {point.text}
            <span className="ml-auto shrink-0 text-[0.66rem] font-semibold uppercase tracking-[0.06em]">
              Not covered
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
