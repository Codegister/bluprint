import { AppShell } from "@/components/AppShell";
import { FlashcardReview } from "@/components/study/FlashcardReview";
import { NextStep } from "@/components/NextStep";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonRows } from "@/components/Skeletons";
import { Meter, enter } from "@/components/motion/Motion";
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
  Play,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SPRINT_LENGTHS = [5, 10, 15, 25] as const;

/**
 * Today, before there is anything to revise.
 *
 * A new account has no sets, so every queue on this screen would be empty. It
 * keeps the same header as the working version and offers the two real ways
 * in — notes now, or courses first — then explains the pipeline in one line so
 * it is obvious what happens after the upload.
 */
function FirstRunOptions() {
  // "Choose courses first" only makes sense before courses exist. Once they do,
  // the second action becomes the course route into a set instead of sending the
  // student back to the picker they already finished.
  const courses = useQuery(api.courses.listMine);
  const readyCourses = (courses ?? []).filter(
    (course) => course.status === "ready",
  );
  const hasCourses = (courses?.length ?? 0) > 0;

  const secondaryAction = hasCourses
    ? { to: "/courses", label: "See your courses" }
    : { to: "/courses/new", label: "Choose courses first" };

  const description =
    courses === undefined
      ? "Today fills up once Bluprint has material to build cards from. The fastest route is one page of notes; courses can come first if you prefer."
      : readyCourses.length > 0
        ? "Your courses are mapped, so a topic can become a set straight away. Add your own notes instead if the material is not part of a course."
        : hasCourses
          ? "Your courses are still mapping. Add a page of notes now, or check the course list in a moment."
          : "Today fills up once Bluprint has material to build cards from. The fastest route is one page of notes; courses can come first if you prefer.";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Today"
        title={hasCourses ? "No study sets yet" : "Nothing to revise yet"}
        description={description}
        actions={
          <>
            <Button
              asChild
              className="h-11 rounded-full px-5 text-sm font-semibold"
            >
              {/* With courses mapped the dialog opens on its Course tab, so
                  this is the one-tap route into a first set. */}
              <Link to="/tutor?new=1">
                {readyCourses.length > 0 ? (
                  <Layers3 className="size-4" aria-hidden />
                ) : (
                  <Camera className="size-4" aria-hidden />
                )}
                {readyCourses.length > 0 ? "Build a study set" : "Add your notes"}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            {/* Wait for the course list before naming this action: showing
                "Choose courses first" to a student who already has courses is
                the bug this replaced. */}
            {courses !== undefined && (
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full px-5 text-sm font-semibold shadow-none"
              >
                <Link to={secondaryAction.to}>
                  <GraduationCap className="size-4" aria-hidden />
                  {secondaryAction.label}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <motion.section
        className="mt-4 rounded-[1.6rem] border border-border bg-card px-5 py-4"
        {...enter(0.1)}
      >
        <p className="mono-label text-chrome-7">How a session works</p>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Capture",
              body: "Photos, a video, pasted notes, or a topic from a course you have mapped.",
              tone: "border-brand-peach/30 bg-brand-peach/15 text-brand-peach",
            },
            {
              step: "2",
              title: "Build",
              body: "NVIDIA writes the summary, flashcards, quiz and exam questions.",
              tone: "border-brand-violet/30 bg-brand-violet/15 text-brand-violet",
            },
            {
              step: "3",
              title: "Revise",
              body: "Cards come back here when they are due. Sprints are one tap.",
              tone: "border-brand-mint/30 bg-brand-mint/15 text-brand-mint",
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-3">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-[0.72rem] font-bold",
                  item.tone,
                )}
              >
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
  // The header owns the length choice; the session panel only starts it.
  const [chosenLength, setChosenLength] = useState(10);
  const activeLength = sprintLength ?? chosenLength;

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

  // First paint: every number here comes from a query, so an unloaded page
  // shows its own shape instead of "0/0 questions" and a 0-day streak.
  if (sets === undefined || study === undefined) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Today"
          title="Today"
          description="Everything due today, in one place."
        />
        <section className="mt-4 rounded-[1.6rem] border border-border bg-card px-4 py-4">
          <SkeletonRows rows={2} />
        </section>
        <section className="mt-6">
          <SkeletonRows rows={3} withAvatar />
        </section>
      </AppShell>
    );
  }

  // A brand-new account gets the options screen rather than a page of empty
  // panels whose buttons cannot do anything.
  if (sets !== undefined && sets.length === 0) {
    return <FirstRunOptions />;
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Today"
        title={
          study?.examInDays !== null && study?.examInDays !== undefined
            ? `${study.examInDays} day${study.examInDays === 1 ? "" : "s"} to ${study.examTitle ?? "your exam"}`
            : "A little every day beats a panic the night before"
        }
        description="Everything due today, in one place. Pick a length, then start."
        actions={
          <>
            <Button
              onClick={() => startSprint(activeLength)}
              className="h-11 rounded-full px-5 text-sm font-semibold"
            >
              <Play className="size-4" aria-hidden />
              Start today&apos;s session
            </Button>
            <div
              role="group"
              aria-label="Session length in cards"
              className="inline-flex items-center rounded-full border border-border bg-card p-1"
            >
              {SPRINT_LENGTHS.map((length) => (
                <button
                  key={length}
                  type="button"
                  aria-pressed={activeLength === length}
                  onClick={() => {
                    setChosenLength(length);
                    if (sprintLength) startSprint(length);
                  }}
                  className={cn(
                    "h-8 min-w-8 rounded-full px-2 text-[0.78rem] font-semibold tabular-nums transition-colors",
                    activeLength === length
                      ? "bg-brand-sky text-brand-cream"
                      : "text-brand-ink/65 hover:bg-brand-sky/10 hover:text-brand-ink",
                  )}
                >
                  {length}
                </button>
              ))}
              <span className="px-2 text-[0.7rem] font-medium text-muted-foreground">
                cards
              </span>
            </div>
          </>
        }
      >
        <p className="mt-2 text-[0.78rem] font-medium text-brand-ink/65">
          {totalDue} due · {weakSets.length} set
          {weakSets.length === 1 ? " needs work" : "s need work"} · about{" "}
          {Math.max(2, Math.round(activeLength / 2))} min
        </p>
      </PageHeader>

      {/* One compact progress strip; the sprint picker lives in the header. */}
      <motion.section
        className="gizmo-card mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3"
        aria-label="Today's progress"
        {...enter(0.08)}
      >
        <div className="flex min-w-[200px] flex-1 items-center gap-2.5">
          <p className="shrink-0 text-[0.76rem] font-semibold tabular-nums text-brand-ink">
            {today}/{goal} questions
          </p>
          <Meter
            value={progress}
            className="h-1.5 max-w-[220px] flex-1 bg-brand-panel"
            barClassName="bg-brand-sky"
            label="Questions answered today"
          />
        </div>
        <p className="flex items-center gap-1.5 text-[0.76rem] font-medium text-brand-ink/75">
          <Flame className="size-3.5 text-brand-peach" aria-hidden />
          {study?.streak ?? 0} day{(study?.streak ?? 0) === 1 ? "" : "s"} streak
        </p>
        {study?.goalReason && (
          <p className="text-[0.72rem] text-muted-foreground sm:ml-auto">
            {study.goalReason}
          </p>
        )}
      </motion.section>

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
              End session
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
                      className="size-4 shrink-0 text-brand-sky"
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

      <NextStep
        to="/timetable"
        title="See what's planned next"
        hint="Your week, day by day, all the way to the exam"
      />
    </AppShell>
  );
}
