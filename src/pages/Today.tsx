import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { FlashcardReview } from "@/components/study/FlashcardReview";
import { SkeletonRows } from "@/components/Skeletons";
import { EASE, Meter, enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Flame,
  Layers3,
  Play,
  RotateCcw,
  Target,
  Timer,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";

const SPRINT_LENGTHS = [5, 10, 15, 25] as const;

/**
 * Today is deliberately secondary. The library of saved sets stays the home
 * screen; this page is the optional "what should I do right now" queue: the
 * cards due across every set, the weak spots that need a second pass, and a
 * sprint the student can size themselves.
 */
export default function Today() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = Number(searchParams.get("sprint"));
  const sprintLength = SPRINT_LENGTHS.includes(
    requested as (typeof SPRINT_LENGTHS)[number],
  )
    ? requested
    : null;

  const study = useQuery(api.studySets.studyStats);
  const sets = useQuery(api.studySets.listMine);
  const sprintCards = useQuery(
    api.studySets.sprintQueue,
    sprintLength ? { length: sprintLength } : "skip",
  );

  const dueSets = (sets ?? []).filter(
    (set) => set.status === "ready" && set.dueCount > 0,
  );
  const weakSets = (sets ?? []).filter(
    (set) => set.status === "ready" && set.weakCount > 0,
  );
  const totalDue = dueSets.reduce((sum, set) => sum + set.dueCount, 0);
  const today = study?.todayCount ?? 0;
  const goal = study?.goal ?? 20;
  const progress = Math.min(100, Math.round((today / Math.max(1, goal)) * 100));

  // Choosing a length starts it: a sprint is meant to remove the decision,
  // not add a second tap.
  const startSprint = (length: number) => {
    setSearchParams({ sprint: String(length) }, { replace: true });
  };

  const clearSprint = () => setSearchParams({}, { replace: true });

  return (
    <AppShell>
      <motion.header
        className="chrome-hero relative overflow-hidden rounded-[2rem] px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7"
        {...enter(0.04, 14)}
      >
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="sticker bg-white/85 text-chrome-7">
              <Target className="size-3" aria-hidden />
              Today
            </span>
            <h1 className="chrome-title mt-3 font-display text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[2.2rem]">
              {study?.examInDays !== null && study?.examInDays !== undefined
                ? `${study.examInDays} day${study.examInDays === 1 ? "" : "s"} to ${study.examTitle ?? "your exam"}`
                : "A little every day beats a panic the night before"}
            </h1>
            <p className="mt-2 max-w-lg text-[0.9rem] leading-relaxed text-brand-ink/65">
              Your library is still on{" "}
              <Link to="/dashboard" className="font-semibold underline underline-offset-2">
                My sets
              </Link>
              . This page is the short answer to “what now?”.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => startSprint(10)}
                className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white shadow-[0_14px_24px_-18px_rgba(25,27,39,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-[#2A2D3E]"
              >
                <Play className="size-4" />
                Quick sprint
              </Button>
              <p className="text-[0.78rem] font-medium text-brand-ink/55">
                {totalDue} due · {weakSets.length} set
                {weakSets.length === 1 ? "" : "s"} with weak spots
              </p>
            </div>
          </div>

          <motion.div
            className="hidden shrink-0 sm:block"
            initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          >
            <Mascot size={126} />
          </motion.div>
        </div>
      </motion.header>

      {/* Goal + streak + sprint picker */}
      <section className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <motion.div className="gizmo-card p-5" {...enter(0.08)}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mono-label text-chrome-7">Daily goal</p>
              <p className="mt-1 font-display text-[1.6rem] font-bold tabular-nums text-brand-ink">
                {today}
                <span className="text-[0.95rem] font-semibold text-muted-foreground">
                  {" "}
                  / {goal} questions
                </span>
              </p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-[#FFF1DE] text-[#B4720E]">
              <Trophy className="size-5" aria-hidden />
            </div>
          </div>
          <Meter
            value={progress}
            className="mt-3 h-2 bg-brand-panel"
            barClassName="bg-chrome-8"
            label="Questions answered today"
          />
          <p className="mt-2 text-[0.76rem] leading-relaxed text-muted-foreground">
            {study?.goalReason ?? "Your goal follows your nearest exam date."}
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {(study?.tiers ?? []).map((tier) => (
              <span
                key={tier.key}
                className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                  tier.reached
                    ? "bg-[#E9FBF3] text-[#128A5B]"
                    : "border border-border bg-white text-muted-foreground"
                }`}
              >
                {tier.label} · {tier.questions}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
            <Flame className="size-4 text-chrome-6" aria-hidden />
            <p className="text-[0.8rem] font-medium text-brand-ink/75">
              {study?.streak
                ? `${study.streak} day streak`
                : "No streak yet — hit the Starter tier to begin"}
            </p>
            {study?.tier && (
              <span className="ml-auto rounded-full bg-brand-panel px-2 py-0.5 text-[0.66rem] font-semibold text-chrome-7">
                {study.tier} tier
              </span>
            )}
          </div>
        </motion.div>

        <motion.div className="gizmo-card p-5" {...enter(0.12)}>
          <p className="mono-label text-chrome-7">Quick sprint</p>
          <h2 className="mt-1 font-display text-[1.15rem] font-bold text-brand-ink">
            Pick your length
          </h2>
          <p className="mt-1 text-[0.78rem] leading-relaxed text-muted-foreground">
            The most useful cards first: everything overdue, then the shakiest
            memories.
          </p>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {SPRINT_LENGTHS.map((length) => (
              <button
                key={length}
                type="button"
                onClick={() => startSprint(length)}
                className={`rounded-2xl border px-2 py-2.5 text-[0.85rem] font-bold tabular-nums transition-colors ${
                  sprintLength === length
                    ? "border-chrome-4 bg-brand-panel text-chrome-7"
                    : "border-border bg-white text-brand-ink/75 hover:bg-brand-panel"
                }`}
              >
                {length}
                <span className="mt-0.5 block text-[0.62rem] font-medium uppercase tracking-[0.08em] opacity-60">
                  cards
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Timer className="size-3.5 text-chrome-7" aria-hidden />
            <p className="text-[0.72rem] text-muted-foreground">
              {sprintLength
                ? `A ${sprintLength}-card sprint is ready below.`
                : "Roughly a minute per five cards."}
            </p>
          </div>
        </motion.div>
      </section>

      {/* Sprint session */}
      {sprintLength && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
              {sprintLength}-card sprint
            </h2>
            <Button
              variant="outline"
              onClick={clearSprint}
              className="h-9 rounded-full border-border bg-white px-3 text-[0.78rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
            >
              <RotateCcw className="size-3.5" /> Change length
            </Button>
          </div>

          <div className="mt-3">
            {sprintCards === undefined ? (
              <div className="gizmo-card p-6">
                <SkeletonRows rows={2} />
              </div>
            ) : sprintCards.length === 0 ? (
              <div className="gizmo-card p-8 text-center text-sm text-muted-foreground">
                No cards are ready for a sprint yet. Build a set first.
              </div>
            ) : (
              <FlashcardReview
                key={`sprint-${sprintLength}`}
                cards={sprintCards}
                sprint
              />
            )}
          </div>
        </section>
      )}

      {/* Due queue + weak spots */}
      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        <div className="gizmo-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h2 className="font-display text-[1rem] font-bold text-brand-ink">
              Due now
            </h2>
            <span className="text-[0.72rem] font-semibold tabular-nums text-muted-foreground">
              {totalDue} cards
            </span>
          </div>
          {sets === undefined ? (
            <SkeletonRows rows={3} />
          ) : dueSets.length === 0 ? (
            <p className="px-5 py-6 text-[0.85rem] text-muted-foreground">
              Nothing is overdue. Today's goal is the only thing left.
            </p>
          ) : (
            <ul>
              {dueSets.map((set) => (
                <li key={set._id}>
                  <Link
                    to={`/sets/${set._id}/cards`}
                    className="flex items-center gap-3 border-b border-border/70 px-5 py-3 last:border-b-0 hover:bg-brand-panel"
                  >
                    <Layers3 className="size-4 shrink-0 text-chrome-7" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[0.85rem] font-medium text-brand-ink">
                      {set.title}
                    </span>
                    <span className="rounded-full bg-[#FFF0DC] px-2 py-0.5 text-[0.66rem] font-semibold text-[#B4720E]">
                      {set.dueCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="gizmo-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h2 className="font-display text-[1rem] font-bold text-brand-ink">
              Weak spots
            </h2>
            <TriangleAlert className="size-4 text-[#D24350]" aria-hidden />
          </div>
          {sets === undefined ? (
            <SkeletonRows rows={3} />
          ) : weakSets.length === 0 ? (
            <p className="px-5 py-6 text-[0.85rem] text-muted-foreground">
              No lapses yet. Cards you miss will gather here.
            </p>
          ) : (
            <ul>
              {weakSets.map((set) => (
                <li key={set._id}>
                  <Link
                    to={`/sets/${set._id}/weak`}
                    className="flex items-center gap-3 border-b border-border/70 px-5 py-3 last:border-b-0 hover:bg-[#FFF7F8]"
                  >
                    <TriangleAlert className="size-4 shrink-0 text-[#D24350]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[0.85rem] font-medium text-brand-ink">
                      {set.title}
                    </span>
                    <span className="rounded-full bg-[#FFEEF0] px-2 py-0.5 text-[0.66rem] font-semibold text-[#C93C49]">
                      {set.weakCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
