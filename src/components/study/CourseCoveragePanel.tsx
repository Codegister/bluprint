import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { CircleDashed } from "lucide-react";

/**
 * "X of Y spec points covered" for a whole course, topic by topic.
 *
 * The statement list comes from the pathway, so a topic with no set built for it
 * shows as uncovered rather than being left out of the count.
 */
export function CourseCoveragePanel({ courseId }: { courseId: Id<"courses"> }) {
  const data = useQuery(api.coverage.forCourse, { courseId });

  if (data === undefined) return <Skeleton className="h-28 w-full rounded-2xl" />;
  if (!data || data.unmapped || data.totals.total === 0) return null;

  return (
    <section className="mt-4 rounded-[1.6rem] border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mono-label text-chrome-7">Specification coverage</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold tabular-nums",
            data.totals.percent >= 70
              ? "bg-[#E9FBF3] text-[#0B6B45]"
              : data.totals.percent >= 40
                ? "bg-[#FFF6E5] text-[#96650A]"
                : "bg-[#FFEEF0] text-[#A81F28]",
          )}
        >
          {data.totals.covered} of {plural(data.totals.total, "point")} ·{" "}
          {data.totals.percent}%
        </span>
      </div>
      <p className="mt-1 text-[0.78rem] leading-relaxed text-muted-foreground">
        Counted from the cards and questions built for each topic. A topic with no
        set built yet counts as uncovered.
      </p>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {data.topics.map((topic) => (
          <li
            key={topic.id}
            className="rounded-xl border border-border bg-white px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[0.78rem] font-semibold text-brand-ink">
                {topic.title}
              </p>
              <span className="shrink-0 text-[0.68rem] font-semibold tabular-nums text-muted-foreground">
                {topic.covered}/{topic.total}
              </span>
            </div>
            {topic.uncovered.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                {topic.uncovered.map((point) => (
                  <li key={point} className="flex items-start gap-1">
                    <CircleDashed className="mt-0.5 size-3 shrink-0" aria-hidden />
                    <span className="line-clamp-2">{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
