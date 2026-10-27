import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
import { DeckGlyph, Mascot } from "@/components/Mascot";
import { CoursePicker } from "@/components/study/CoursePicker";
import { QuickSprint } from "@/components/study/QuickSprint";
import { StreakBanner } from "@/components/study/StreakBanner";
import { TutorLauncher } from "@/components/study/TutorLauncher";
import { SkeletonRows } from "@/components/Skeletons";
import { Meter, enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { qualificationLabel } from "@/lib/examBoards";
import { displayName, relativeDate } from "@/lib/format";
import { subjectMeta } from "@/lib/subjects";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, LayoutDashboard, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

type SetSummary = FunctionReturnType<typeof api.studySets.listMine>[number];

function StatusText({ set }: { set: SetSummary }) {
  if (set.status === "processing" || set.status === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-[#96650A]">
        <Loader2 className="size-3 animate-spin" />
        Building
      </span>
    );
  }
  if (set.status === "error") {
    return (
      <span className="text-[0.72rem] font-semibold text-[#C23B49]">
        Build interrupted
      </span>
    );
  }
  return <span className="text-[0.72rem] font-medium text-[#128A4C]">Ready</span>;
}

/** One saved set, shown as a single scannable row. */
function SetRow({ set }: { set: SetSummary }) {
  const readiness = set.readiness;
  const processing = set.status === "processing" || set.status === "queued";
  const context = qualificationLabel(set);
  const accent = subjectMeta(set.course ?? "").color;

  return (
    <Link
      to={`/sets/${set._id}`}
      className="group flex items-center gap-3.5 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-brand-panel sm:gap-4 sm:px-5"
    >
      <DeckGlyph className="size-9 shrink-0" color={accent} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="truncate font-display text-[0.98rem] font-bold text-brand-ink">
            {set.title}
          </h3>
          <StatusText set={set} />
          {set.status === "ready" && set.dueCount > 0 && (
            <span className="text-[0.72rem] font-semibold text-[#C2660F]">
              {set.dueCount} due
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[0.76rem] text-muted-foreground">
          {context ? `${context} · ` : ""}
          {set.cardCount} cards · {set.quizCount} quiz · {set.examCount} exam
        </p>
        {processing ? (
          <p className="mt-1.5 text-[0.72rem] text-[#96650A]">
            {set.progress || "Waiting to start"}
          </p>
        ) : set.status === "error" ? (
          <p className="mt-1.5 text-[0.72rem] text-muted-foreground">
            Open to rebuild this set.
          </p>
        ) : (
          <div className="mt-2 flex items-center gap-2.5">
            <Meter
              value={readiness}
              className="h-1.5 w-full max-w-[180px]"
              barStyle={{ backgroundColor: accent }}
              label={`${set.title} exam readiness`}
            />
            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
              {readiness}% exam-ready
            </span>
          </div>
        )}
      </div>

      <div className="hidden w-36 shrink-0 text-right text-[0.74rem] text-muted-foreground sm:block">
        {set.status === "ready" ? (
          <>
            <p className="font-medium text-brand-ink">
              {set.pace
                ? `${set.pace.daysLeft}d to exam`
                : set.lastQuizTotal
                  ? `${set.lastQuizScore}/${set.lastQuizTotal} last quiz`
                  : "No quiz yet"}
            </p>
            <p className="mt-0.5">
              {set.pace
                ? `${set.pace.perDay} cards/day`
                : set.lastStudiedAt
                  ? `Studied ${relativeDate(set.lastStudiedAt)}`
                  : "Not started"}
            </p>
          </>
        ) : (
          <p>{processing ? "In progress" : "Open to rebuild"}</p>
        )}
      </div>

      <ChevronRight className="size-4 shrink-0 text-brand-ink/30 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * Home.
 *
 * The screen is ordered as one study loop: ask the tutor, pick the course you
 * are working on, open a saved set, then start a short sprint. The old separate
 * action hub is gone; these four sections are the actions.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const sets = useQuery(api.studySets.listMine);
  const courses = useQuery(api.courses.listMine);
  const study = useQuery(api.studySets.studyStats);
  const ai = useQuery(api.settings.aiStatus);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const dialogOpen = searchParams.get("new") === "1";
  const requestedCourse = searchParams.get("course");
  // Only trust a course id that still belongs to this account.
  const selectedCourse =
    courses?.find((course) => course._id === requestedCourse) ?? null;

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const setDialogOpen = (open: boolean) =>
    updateParams({ new: open ? "1" : null });
  const selectCourse = (courseId: string | null) =>
    updateParams({ course: courseId });

  const stats = useMemo(() => {
    const list = sets ?? [];
    const ready = list.filter((set) => set.status === "ready");
    const due = list.reduce((sum, set) => sum + (set.dueCount ?? 0), 0);
    return {
      due,
      // Exam readiness (recall + quiz + written marks), not the old "known"
      // count, is the mastery number on Home.
      readiness: ready.length
        ? Math.round(
            ready.reduce((sum, set) => sum + set.readiness, 0) / ready.length,
          )
        : 0,
    };
  }, [sets]);

  const courseSets = useMemo(
    () =>
      (sets ?? []).filter(
        (set) => !selectedCourse || set.course === selectedCourse.subject,
      ),
    [sets, selectedCourse],
  );

  const filteredSets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return courseSets;
    return courseSets.filter((set) =>
      [set.title, set.course ?? "", set.examBoard ?? "", set.level ?? ""].some(
        (value) => value.toLowerCase().includes(query),
      ),
    );
  }, [courseSets, search]);

  const headerLine = useMemo(() => {
    if (study && stats.due > 0) {
      return `${stats.due} ${stats.due === 1 ? "card is" : "cards are"} ready for review.`;
    }
    if (sets && sets.length > 0) {
      return "Your tutor, courses and sets are all here. Pick one to get going.";
    }
    return "Ask the tutor, add your courses, or turn a page of notes into a full study set.";
  }, [study, stats.due, sets]);

  return (
    <AppShell>
      <motion.header
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        {...enter(0.02, 10)}
      >
        <div className="min-w-0">
          <span className="sticker -rotate-1 bg-gizmo-lime text-brand-ink">
            <LayoutDashboard className="size-3" aria-hidden />
            Dashboard
          </span>
          <h1 className="mt-2.5 font-display text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-brand-ink sm:text-[2.15rem]">
            Welcome back,{" "}
            <span className="highlighter">
              {displayName(user?.name, user?.email)}
            </span>
          </h1>
          <p className="mt-1.5 max-w-lg text-[0.88rem] leading-relaxed text-brand-ink/65">
            {headerLine}
          </p>
          <p className="mt-2 text-[0.75rem] font-medium text-brand-ink/55">
            {sets ? (
              <>
                {sets.length} {sets.length === 1 ? "set" : "sets"} ·{" "}
                {stats.readiness}% exam-ready
                {study
                  ? ` · ${study.todayCount}/${study.goal} questions today`
                  : ""}
              </>
            ) : (
              "Loading your library…"
            )}
          </p>
        </div>

        <Button
          onClick={() => setDialogOpen(true)}
          className="h-11 shrink-0 rounded-full px-5 text-sm font-semibold"
        >
          New study set
          <ArrowRight className="size-4" />
        </Button>
      </motion.header>

      {ai && !ai.configured && (
        <p className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-2.5 text-[0.8rem] font-medium text-[#96650A]">
          AI is not connected on this deployment. Add NVIDIA_API_KEY to build new
          study sets and use the tutor. Saved material still works.
        </p>
      )}

      {/* 1. Tutor. The panel carries the question into the full tutor screen. */}
      <div className="mt-4">
        <TutorLauncher selectedCourse={selectedCourse} aiReady={ai?.configured} />
      </div>

      {/* 2. Course selection. Scopes the tutor above and the sets below. */}
      <div className="mt-3">
        <CoursePicker
          courses={courses}
          selected={selectedCourse?._id ?? null}
          onSelect={selectCourse}
        />
      </div>

      {/* 3. Saved study sets. */}
      <section className="mt-7" aria-labelledby="sets-heading">
        <motion.div
          className="flex flex-wrap items-end gap-x-3 gap-y-2"
          {...enter(0.14)}
        >
          <h2
            id="sets-heading"
            className="font-display text-[1.15rem] font-bold text-brand-ink"
          >
            Your study sets
          </h2>
          <span className="text-[0.74rem] font-semibold tabular-nums text-muted-foreground">
            {selectedCourse ? `${courseSets.length} of ${sets?.length ?? 0}` : sets?.length ?? 0}
          </span>
          {selectedCourse && (
            <span className="rounded-full bg-gizmo-lilac/60 px-2 py-0.5 text-[0.68rem] font-semibold text-[#1C1A14]">
              {selectedCourse.subject}
            </span>
          )}
          <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
          {(sets?.length ?? 0) > 0 && (
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search study sets"
              aria-label="Search study sets"
              className="h-9 w-full rounded-full border-border bg-card text-[0.8rem] shadow-none placeholder:text-muted-foreground/60 sm:ml-auto sm:w-56"
            />
          )}
        </motion.div>

        <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-card">
          {sets === undefined ? (
            <div role="status" aria-busy="true" aria-live="polite">
              <span className="sr-only">Loading your study sets</span>
              <SkeletonRows rows={5} withAvatar />
            </div>
          ) : sets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-7 text-center sm:flex-row sm:text-left">
              <Mascot size={92} float={false} className="shrink-0" />
              <div>
                <p className="font-display text-[1rem] font-bold text-brand-ink">
                  Your first set starts with a page of notes
                </p>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground">
                  Upload photos or paste text, and Bluprint writes the summary,
                  flashcards, quiz and exam questions.
                </p>
                <Button
                  onClick={() => setDialogOpen(true)}
                  variant="outline"
                  className="mt-3 h-9 rounded-full px-4 text-[0.8rem] font-semibold shadow-none"
                >
                  Add your notes
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : courseSets.length === 0 && selectedCourse ? (
            <div className="flex flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="font-display text-[0.98rem] font-bold text-brand-ink">
                  No sets for {selectedCourse.subject} yet
                </p>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground">
                  Build one from a course topic, or upload your own notes and tag
                  them later.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Button
                  asChild
                  variant="outline"
                  className="h-9 rounded-full px-4 text-[0.8rem] font-semibold shadow-none"
                >
                  <Link to={`/courses/${selectedCourse._id}`}>Open course</Link>
                </Button>
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="h-9 rounded-full px-4 text-[0.8rem] font-semibold"
                >
                  Add notes
                </Button>
              </div>
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6">
              <p className="text-[0.82rem] text-muted-foreground">
                No sets match “{search}”.
              </p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[0.8rem] font-semibold text-brand-ink underline-offset-2 hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="rise-stagger">
              {filteredSets.map((set) => (
                <SetRow key={set._id} set={set} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Streak banner, then the quick sprint: habit first, then the
             shortest way to move it today. */}
      <div className="mt-4">
        <StreakBanner />
      </div>
      <QuickSprint />

      <CreateSetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
