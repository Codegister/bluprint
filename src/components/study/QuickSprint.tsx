import { Meter, enter } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";
import { Link } from "react-router";

const SPRINT_LENGTHS = [5, 10, 15, 25] as const;

/**
 * The closing card on the dashboard: today's goal, the streak, and four
 * one-tap sprint lengths. Choosing a length starts the session on Today, where
 * the card runner already lives — no second decision, no new screen.
 */
export function QuickSprint() {
  const study = useQuery(api.studySets.studyStats);
  const today = study?.todayCount ?? 0;
  const goal = study?.goal ?? 20;
  const progress = Math.min(100, Math.round((today / Math.max(1, goal)) * 100));

  return (
    <section aria-labelledby="quick-sprint-heading" className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          id="quick-sprint-heading"
          className="font-display text-[1.15rem] font-bold text-brand-ink"
        >
          Quick sprint
        </h2>
        <p className="text-[0.76rem] leading-relaxed text-muted-foreground">
          A few cards, right now — the shakiest memories come first.
        </p>
        <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
        <Link
          to="/today"
          className="inline-flex items-center gap-1 text-[0.76rem] font-semibold text-brand-ink/70 hover:text-brand-ink hover:underline"
        >
          Today's queue
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <motion.div
        className="chrome-plate mt-3 rounded-[1.6rem] p-4 sm:p-5"
        {...enter(0.16, 10)}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex max-w-md items-baseline justify-between gap-2">
              <p className="mono-label text-chrome-7">Today</p>
              <p className="text-[0.7rem] font-semibold tabular-nums text-brand-ink/60">
                {study ? `${today}/${goal} questions` : "—"}
              </p>
            </div>
            <Meter
              value={progress}
              className="mt-1.5 h-1.5 max-w-md bg-brand-panel"
              barClassName="bg-chrome-8"
              label="Questions answered today"
            />
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[0.72rem] leading-snug text-brand-ink/60">
              <span className="inline-flex items-center gap-1 font-semibold text-brand-ink/80">
                <Flame className="size-3.5 text-brand-pink-deep" aria-hidden />
                {study?.streak ?? 0} day{study?.streak === 1 ? "" : "s"}
              </span>
              {study?.goalReason ? `· ${study.goalReason}` : "· every card counts"}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-[0.7rem] font-semibold text-brand-ink/60 sm:text-right">
              Pick a length
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {SPRINT_LENGTHS.map((length) => (
                <Link
                  key={length}
                  to={`/today?sprint=${length}`}
                  title={`Start a ${length}-card sprint`}
                  className="flex h-[58px] w-full flex-col items-center justify-center rounded-2xl border border-brand-ink/20 bg-gizmo-peach/70 px-2 text-[#1C1A14] shadow-[0_2px_0_rgba(28,26,20,0.1)] transition-transform hover:-translate-y-0.5 hover:border-brand-ink/40 sm:w-16 dark:shadow-none"
                >
                  <span className="font-display text-[1.05rem] font-bold tabular-nums leading-none">
                    {length}
                  </span>
                  <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] opacity-70">
                    cards
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
