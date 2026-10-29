import { Meter } from "@/components/motion/Motion";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Check, CircleDashed } from "lucide-react";

/**
 * The specification, statement by statement, for a whole course.
 *
 * It used to sit above the course tabs, pushing the pathway down the page. It
 * is a screen of its own now: every statement the pathway carries, grouped by
 * unit, ticked once material built for its topic teaches it.
 */
export function CourseCoveragePanel({ courseId }: { courseId: Id<"courses"> }) {
  const data = useQuery(api.coverage.forCourse, { courseId });

  if (data === undefined) {
    return <Skeleton className="mt-4 h-48 w-full rounded-[2rem]" />;
  }
  if (!data) return null;

  if (data.unmapped || data.totals.total === 0) {
    return (
      <section className="mt-4 rounded-[2rem] border border-dashed border-border bg-white px-5 py-10 text-center">
        <p className="font-display text-[1.05rem] font-bold text-brand-ink">
          No specification points yet
        </p>
        <p className="mx-auto mt-1 max-w-md text-[0.84rem] leading-relaxed text-muted-foreground">
          This pathway has no specification statements saved against its topics.
          Rebuild the pathway and its statements appear here to tick off.
        </p>
      </section>
    );
  }

  // Topics arrive flat and in pathway order, so keeping first-seen order makes
  // the checklist follow the same units as the Pathway tab.
  const units: Array<{
    title: string;
    topics: typeof data.topics;
  }> = [];
  for (const topic of data.topics) {
    const last = units[units.length - 1];
    if (last && last.title === topic.unit) last.topics.push(topic);
    else units.push({ title: topic.unit, topics: [topic] });
  }

  return (
    <section className="mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-chrome-7">
            Specification coverage
          </p>
          <h2 className="mt-1 font-display text-[1.2rem] font-bold text-brand-ink">
            Every spec point, ticked as it is covered
          </h2>
          <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
            A point ticks itself once a card or question built for its topic
            teaches it. Points with nothing behind them stay open, so the list
            also shows what to build next.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1.5 text-[0.72rem] font-bold tabular-nums",
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

      <Meter
        value={data.totals.percent}
        className="mt-3 h-1.5"
        barClassName="bg-[#0B6B45]"
        label="Specification covered"
      />

      <div className="mt-5 space-y-5">
        {units.map((unit, unitIndex) => {
          const covered = unit.topics.reduce(
            (sum, topic) => sum + topic.covered,
            0,
          );
          const total = unit.topics.reduce(
            (sum, topic) => sum + topic.total,
            0,
          );
          return (
            <div key={`${unit.title}-${unitIndex}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-[0.98rem] font-bold text-brand-ink">
                  {unit.title}
                </h3>
                <span className="shrink-0 text-[0.7rem] font-semibold tabular-nums text-muted-foreground">
                  {covered} of {plural(total, "point")}
                </span>
              </div>

              <ul className="mt-2 space-y-2">
                {unit.topics
                  .filter((topic) => topic.total > 0)
                  .map((topic) => (
                    <li
                      key={topic.id}
                      className="rounded-2xl border border-border bg-[#FCFCFD] px-3.5 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[0.84rem] font-semibold text-brand-ink">
                          {topic.title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[0.64rem] font-semibold tabular-nums",
                            topic.covered === topic.total
                              ? "bg-[#EAFBF0] text-[#0B6B45]"
                              : "bg-brand-panel text-brand-ink/60",
                          )}
                        >
                          {topic.covered}/{topic.total}
                        </span>
                      </div>

                      <ul className="mt-2 space-y-1.5">
                        {topic.points.map((point) => (
                          <li
                            key={point.id}
                            className="flex items-start gap-2 text-[0.78rem] leading-relaxed"
                          >
                            {point.covered ? (
                              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#0B6B45] text-white">
                                <Check
                                  className="size-2.5"
                                  strokeWidth={3}
                                  aria-hidden
                                />
                                <span className="sr-only">Covered</span>
                              </span>
                            ) : (
                              <>
                                <CircleDashed
                                  className="mt-0.5 size-4 shrink-0 text-brand-ink/25"
                                  aria-hidden
                                />
                                <span className="sr-only">Not covered</span>
                              </>
                            )}
                            <span
                              className={cn(
                                point.covered
                                  ? "text-brand-ink/75"
                                  : "text-muted-foreground",
                              )}
                            >
                              {point.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
