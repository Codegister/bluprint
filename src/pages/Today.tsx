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
  ArrowRight,
  Camera,
  Flame,
  GraduationCap,
  Layers3,
  LayoutGrid,
  Play,
  RotateCcw,
  Target,
  Timer,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

const SPRINT_LENGTHS = [5, 10, 15, 25] as const;

/**
 * First-run options.
 *
 * A new account has no sets, so every control on Today would be a dead end.
 * Instead the screen becomes a short menu: the three ways to get material into
 * Bluprint, each a link to the screen that does it, followed by the pipeline in
 * one line so it is obvious what happens after the upload.
 */
function FirstRunOptions() {
  const options = [
    {
      to: "/tutor?new=1",
      icon: Camera,
      title: "Add notes from your phone",
      body: "Photograph up to eight pages, pick a short video, or paste text. Bluprint reads it and writes the whole set.",
      action: "Upload material",
    },
    {
      to: "/courses/new",
      icon: GraduationCap,
      title: "Set up your courses",
      body: "Choose your qualification, board and subjects, and every topic in the specification becomes a study set.",
      action: "Choose courses",
    },
    {
      to: "/tutor",
      icon: LayoutGrid,
      title: "Your AI tutor",
      body: "Ask the tutor about a course, open a saved set and keep your streak going — all on one screen.",
      action: "Open the tutor",
    },
  ] as const;

  return (
    <AppShell>
      <motion.header
        className="chrome-hero relative overflow-hidden rounded-[2rem] px-5 pb-6 pt-7 sm:px-7 sm:pb-7"
        {...enter(0.04, 14)}
      >
        <span className="chrome-metal-sheen" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="sticker">
              <Target className="size-3" aria-hidden />
              Today · first run
            </span>
            <h1 className="chrome-title mt-3 font-display text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[2.2rem]">
              Nothing to revise yet — add your first page of notes
            </h1>
            <p className="mt-2 max-w-lg text-[0.92rem] leading-relaxed text-brand-ink/65">
              Today fills up with cards once Bluprint has material to build from.
              Pick one of the options below; each one ends with a ready study set.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="h-11 rounded-full px-5 text-sm font-semibold"
              >
                <Link to="/tutor?new=1">
                  <Camera className="size-4" aria-hidden />
                  Add your notes
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Link
                to="/courses/new"
                className="text-[0.82rem] font-semibold text-brand-ink underline-offset-4 hover:underline"
              >
                or choose your courses first
              </Link>
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

      <section className="mt-6" aria-labelledby="first-run-options">
        <h2
          id="first-run-options"
          className="font-display text-[1.15rem] font-bold text-brand-ink"
        >
          Choose where to start
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option, index) => {
            const Icon = option.icon;
            return (
              <motion.div key={option.title} {...enter(0.08 + index * 0.05)}>
                <Link
                  to={option.to}
                  className="lift group flex h-full flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-[0_2px_0_rgba(10,15,21,0.12)] hover:border-chrome-8"
                >
                  <span className="grid size-12 place-items-center rounded-2xl border border-chrome-8 bg-brand-ink text-gizmo-lime shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-[1rem] font-bold leading-snug text-brand-ink">
                      {option.title}
                    </p>
                    <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                      {option.body}
                    </p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[0.8rem] font-semibold text-brand-pink-deep">
                    {option.action}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <motion.section
        className="mt-6 rounded-3xl border border-border bg-card p-5"
        {...enter(0.24)}
      >
        <p className="mono-label text-chrome-7">What happens next</p>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Capture",
              body: "Photos, a video, or pasted notes. Up to eight pages per set.",
            },
            {
              step: "2",
              title: "Build",
              body: "NVIDIA writes the summary, flashcards, quiz and exam questions.",
            },
            {
              step: "3",
              title: "Revise",
              body: "Cards come back here when they are due. Sprints are one tap.",
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-chrome-8 bg-brand-ink text-[0.72rem] font-bold text-white">
                {item.step}
              </span>
              <div>
                <p className="text-[0.85rem] font-semibold text-brand-ink">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[0.78rem] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </motion.section>
    </AppShell>
  );
}

/**
 * Today is deliberately secondary. The library of saved sets stays the home
 * screen; this page is the optional "what should I do right now" queue: the
 * cards due across every set, the weak spots that need a second pass, and a
 * sprint the student can size themselves.
 */
export default function Today() {
  const navigate = useNavigate();
  const sprintRef = useRef<HTMLElement>(null);
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

  const readySets = (sets ?? []).filter((set) => set.status === "ready");
  const dueSets = readySets.filter((set) => set.dueCount > 0);
  const weakSets = readySets.filter((set) => set.weakCount > 0);
  const totalDue = dueSets.reduce((sum, set) => sum + set.dueCount, 0);
  const totalCards = readySets.reduce((sum, set) => sum + set.cardCount, 0);
  const buildingSets = (sets ?? []).filter(
    (set) => set.status === "queued" || set.status === "processing",
  );
  const today = study?.todayCount ?? 0;
  const goal = study?.goal ?? 20;
  const progress = Math.min(100, Math.round((today / Math.max(1, goal)) * 100));

  /**
   * Choosing a length starts it: a sprint is meant to remove the decision, not
   * add a second tap. When there is nothing to draw from, say why and offer the
   * one action that fixes it instead of leaving the screen unchanged.
   */
  const startSprint = (length: number) => {
    if (sets === undefined) {
      toast.message("Still loading your sets", {
        description: "Give it a second, then pick a sprint length again.",
      });
      return;
    }

    if (sets.length === 0) {
      toast.error("There is nothing to sprint through yet", {
        description: "Add some notes and Bluprint will build the cards first.",
        action: { label: "Add notes", onClick: () => navigate("/tutor?new=1") },
      });
      return;
    }

    if (totalCards === 0) {
      toast.error(
        buildingSets.length > 0
          ? "Your sets are still building"
          : "No study cards yet",
        {
          description:
            buildingSets.length > 0
              ? "Open a set to watch it build — this page fills up automatically when it finishes."
              : "Open a set and rebuild it, or add new material to create one.",
          action: {
            label: buildingSets.length > 0 ? "Open sets" : "Add notes",
            onClick: () =>
              navigate(
                buildingSets.length > 0 && sets?.[0]
                  ? `/sets/${sets[0]._id}`
                  : "/tutor?new=1",
              ),
          },
        },
      );
      return;
    }

    setSearchParams({ sprint: String(length) }, { replace: true });
  };

  const clearSprint = () => setSearchParams({}, { replace: true });

  // A sprint starts where it happens: choosing a length brings the session into
  // view instead of leaving the new panel somewhere below the fold.
  useEffect(() => {
    if (!sprintLength) return;
    sprintRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sprintLength]);

  // A brand-new account gets the options screen rather than a page of empty
  // panels whose buttons cannot do anything.
  if (sets !== undefined && sets.length === 0) {
    return <FirstRunOptions />;
  }

  return (
    <AppShell>
      <motion.header
        className="chrome-hero relative overflow-hidden rounded-[2rem] px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7"
        {...enter(0.04, 14)}
      >
        <span className="chrome-metal-sheen" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="sticker">
              <Target className="size-3" aria-hidden />
              Today
            </span>
            <h1 className="chrome-title mt-3 font-display text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[2.2rem]">
              {study?.examInDays !== null && study?.examInDays !== undefined
                ? `${study.examInDays} day${study.examInDays === 1 ? "" : "s"} to ${study.examTitle ?? "your exam"}`
                : "A little every day beats a panic the night before"}
            </h1>
            <p className="mt-2 max-w-lg text-[0.9rem] leading-relaxed text-brand-ink/65">
              Your tutor, courses and sets are on the{" "}
              <Link
                to="/tutor"
                className="font-semibold underline underline-offset-2"
              >
                tutor home
              </Link>
              . This page is the short answer to “what now?”.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => startSprint(10)}
                className="h-11 rounded-full px-5 text-sm font-semibold"
              >
                <Play className="size-4" aria-hidden />
                Quick sprint
              </Button>
              <p className="text-[0.78rem] font-medium text-brand-ink/65">
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
            <div className="grid size-12 place-items-center rounded-2xl border border-[#8a6b2a] bg-[#f4e3bd] text-[#5b3d00]">
              <Trophy className="size-5" aria-hidden />
            </div>
          </div>
          <Meter
            value={progress}
            className="mt-3 h-2 bg-brand-panel"
            barClassName="bg-chrome-8"
            label="Questions answered today"
          />
          <p className="mt-2 text-[0.78rem] leading-relaxed text-muted-foreground">
            {study?.goalReason ?? "Your goal follows your nearest exam date."}
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {(study?.tiers ?? []).map((tier) => (
              <span
                key={tier.key}
                className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                  tier.reached
                    ? "border border-[#1d6b45] bg-[#d2e7de] text-[#0d4a2e]"
                    : "border border-border bg-white text-brand-ink"
                }`}
              >
                {tier.label} · {tier.questions}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
            <Flame className="size-4 text-chrome-6" aria-hidden />
            <p className="text-[0.8rem] font-medium text-brand-ink/80">
              {study?.streak
                ? `${study.streak} day streak`
                : "No streak yet — hit the Starter tier to begin"}
            </p>
            {study?.tier && (
              <span className="ml-auto rounded-full border border-border bg-brand-panel px-2 py-0.5 text-[0.66rem] font-semibold text-chrome-7">
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
                title={`Start a ${length}-card sprint`}
                className={`rounded-2xl border px-2 py-2.5 text-[0.85rem] font-bold tabular-nums transition-colors ${
                  sprintLength === length
                    ? "border-chrome-8 bg-gizmo-lime text-brand-ink"
                    : "border-border bg-white text-brand-ink hover:border-chrome-8 hover:bg-brand-panel"
                }`}
              >
                {length}
                <span className="mt-0.5 block text-[0.62rem] font-medium uppercase tracking-[0.08em]">
                  cards
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Timer className="size-3.5 text-chrome-7" aria-hidden />
            <p className="text-[0.74rem] text-muted-foreground">
              {sprintLength
                ? `A ${sprintLength}-card sprint is ready below.`
                : "Roughly a minute per five cards."}
            </p>
          </div>
        </motion.div>
      </section>

      {/* Sprint session */}
      {sprintLength && (
        <section className="mt-6 scroll-mt-24" ref={sprintRef}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
              {sprintLength}-card sprint
            </h2>
            <Button
              variant="outline"
              onClick={clearSprint}
              className="h-9 rounded-full px-3 text-[0.78rem] font-semibold shadow-none"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Change length
            </Button>
          </div>

          <div className="mt-3">
            {sprintCards === undefined ? (
              <div className="gizmo-card p-6">
                <SkeletonRows rows={2} />
              </div>
            ) : sprintCards.length === 0 ? (
              <div className="gizmo-card p-6 text-center">
                <p className="text-sm font-semibold text-brand-ink">
                  No cards are ready for a sprint yet
                </p>
                <p className="mx-auto mt-1 max-w-md text-[0.82rem] leading-relaxed text-muted-foreground">
                  {buildingSets.length > 0
                    ? "Your sets are still building. This page fills in as soon as the cards are saved."
                    : "Open a set to rebuild it, or add new material to create cards."}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-3 h-9 rounded-full px-4 text-[0.8rem] font-semibold shadow-none"
                >
                  <Link
                    to={
                      buildingSets.length > 0 && sets?.[0]
                        ? `/sets/${sets[0]._id}`
                        : "/tutor?new=1"
                    }
                  >
                    {buildingSets.length > 0 ? "Open your sets" : "Add notes"}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
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
              Nothing is overdue. Today&apos;s goal is the only thing left.
            </p>
          ) : (
            <ul>
              {dueSets.map((set) => (
                <li key={set._id}>
                  <Link
                    to={`/sets/${set._id}/cards`}
                    className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-brand-panel"
                  >
                    <Layers3
                      className="size-4 shrink-0 text-chrome-7"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[0.85rem] font-medium text-brand-ink">
                      {set.title}
                    </span>
                    <span className="rounded-full border border-[#8a6b2a] bg-[#f4e3bd] px-2 py-0.5 text-[0.66rem] font-semibold text-[#5b3d00]">
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
            <TriangleAlert className="size-4 text-[#8f1d26]" aria-hidden />
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
                    className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-brand-panel"
                  >
                    <TriangleAlert
                      className="size-4 shrink-0 text-[#8f1d26]"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[0.85rem] font-medium text-brand-ink">
                      {set.title}
                    </span>
                    <span className="rounded-full border border-[#a0525b] bg-[#f7dfe2] px-2 py-0.5 text-[0.66rem] font-semibold text-[#7a131c]">
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
