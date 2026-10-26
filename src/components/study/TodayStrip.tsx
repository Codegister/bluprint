import { Meter } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { ArrowRight, Flame, Play } from "lucide-react";
import { Link } from "react-router";

/**
 * A compact "today" row on Home. The saved sets stay the main event; this is a
 * single line of orientation: the exam-derived goal, the tiered streak and a
 * one-tap sprint.
 */
export function TodayStrip() {
  const study = useQuery(api.studySets.studyStats);
  const today = study?.todayCount ?? 0;
  const goal = study?.goal ?? 20;
  const progress = Math.min(100, Math.round((today / Math.max(1, goal)) * 100));

  return (
    <section className="mt-4 rounded-[1.6rem] border border-border bg-white/85 p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 sm:w-56">
          <div className="flex items-baseline justify-between gap-2">
            <p className="mono-label text-[#5B3DF5]">Today</p>
            <p className="text-[0.7rem] font-semibold tabular-nums text-brand-ink/55">
              {study ? `${today}/${goal} questions` : "—"}
            </p>
          </div>
          <Meter
            value={progress}
            className="mt-1.5 h-1.5 bg-[#ECE6FF]"
            barClassName="bg-[#5B3DF5]"
            label="Questions answered today"
          />
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[0.7rem] leading-snug text-brand-ink/60">
            <span className="inline-flex items-center gap-1 font-semibold text-brand-ink/80">
              <Flame className="size-3 text-[#F0871F]" aria-hidden />
              {study?.streak ?? 0} day{study?.streak === 1 ? "" : "s"}
            </span>
            {study?.goalReason ? `· ${study.goalReason}` : ""}
          </p>
        </div>

        <div className="hidden h-10 border-l border-dashed border-border sm:block" />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[0.72rem] font-semibold text-brand-ink/60">
            Quick sprint
          </span>
          {[5, 10, 15, 25].map((length) => (
            <Link
              key={length}
              to={`/today?sprint=${length}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-[0.72rem] font-bold tabular-nums text-brand-ink/75 transition-colors hover:border-[#CFC4FF] hover:bg-[#F3ECFF] hover:text-[#5B3DF5]"
            >
              <Play className="size-2.5" aria-hidden />
              {length}
            </Link>
          ))}
        </div>

        <Link
          to="/today"
          className="inline-flex shrink-0 items-center gap-1 text-[0.76rem] font-semibold text-[#5B3DF5] hover:underline"
        >
          Today's queue
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
