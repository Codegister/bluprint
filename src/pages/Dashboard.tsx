import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
import { DeckGlyph, Mascot } from "@/components/Mascot";
import { TodayStrip } from "@/components/study/TodayStrip";
import { SkeletonRows } from "@/components/Skeletons";
import { EASE, Meter, enter } from "@/components/motion/Motion";
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
import { ArrowRight, ChevronRight, Layers3, Loader2 } from "lucide-react";
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
      className="group flex items-center gap-3.5 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-[#FBF7FF] sm:gap-4 sm:px-5"
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
 * Home is deliberately one screen with one job: your saved study sets.
 * Courses and the tutor each have their own screen, so nothing competes with
 * the list here.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const sets = useQuery(api.studySets.listMine);
  const study = useQuery(api.studySets.studyStats);
  const ai = useQuery(api.settings.aiStatus);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const dialogOpen = searchParams.get("new") === "1";

  const setDialogOpen = (open: boolean) => {
    setSearchParams(open ? { new: "1" } : {}, { replace: true });
  };

  const stats = useMemo(() => {
    const list = sets ?? [];
    const ready = list.filter((set) => set.status === "ready");
    const due = list.reduce((sum, set) => sum + (set.dueCount ?? 0), 0);
    return {
      // Exam readiness (recall + quiz + written marks), not the old "known"
      // count, is the mastery number on Home.
      readiness: ready.length
        ? Math.round(ready.reduce((sum, set) => sum + set.readiness, 0) / ready.length)
        : 0,
      due,
    };
  }, [sets]);

  // Study-set courses are free text, so the filter is built from what the
  // account actually contains rather than a fixed list.
  const courseFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const set of sets ?? []) {
      if (!set.course) continue;
      counts.set(set.course, (counts.get(set.course) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sets]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (sets ?? []).filter((set) => {
      const matchesCourse = courseFilter === "all" || set.course === courseFilter;
      const matchesSearch =
        !query ||
        [set.title, set.course ?? "", set.examBoard ?? "", set.level ?? ""].some(
          (value) => value.toLowerCase().includes(query),
        );
      return matchesCourse && matchesSearch;
    });
  }, [sets, search, courseFilter]);

  return (
    <AppShell>
      <motion.header
        className="chrome-hero relative overflow-hidden rounded-[2rem] px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7"
        {...enter(0.04, 14)}
      >
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="sticker bg-white/85 text-[#5B3DF5]">
              <Layers3 className="size-3" aria-hidden />
              Your library
            </span>
            <h1 className="chrome-title mt-3 font-display text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[2.2rem]">
              Welcome back,{" "}
              <span className="text-[#5B3DF5]">
                {displayName(user?.name, user?.email)}
              </span>
            </h1>
            <p className="mt-2 max-w-md text-[0.9rem] leading-relaxed text-brand-ink/65">
              {stats.due > 0
                ? `${stats.due} ${stats.due === 1 ? "card is" : "cards are"} ready for review. Pick a set below to start.`
                : "Every set you have built lives here. Open one to study, or start a new set from your notes."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => setDialogOpen(true)}
                className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white shadow-[0_14px_24px_-18px_rgba(25,27,39,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-[#2A2D3E]"
              >
                New study set
                <ArrowRight className="size-4" />
              </Button>
              <p className="text-[0.78rem] font-medium text-brand-ink/55">
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
          </div>

          <motion.div
            className="hidden shrink-0 sm:block"
            initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
            whileHover={{ rotate: 3, scale: 1.03 }}
          >
            <Mascot size={132} />
          </motion.div>
        </div>
      </motion.header>

      {ai && !ai.configured && (
        <p className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-2.5 text-[0.8rem] font-medium text-[#96650A]">
          AI is not connected on this deployment. Add NVIDIA_API_KEY to build new
          study sets. Saved material still works.
        </p>
      )}

      {/* Secondary by design: the saved sets stay the main screen. */}
      <TodayStrip />

      <section className="mt-8">
        <motion.div className="flex flex-wrap items-center gap-2.5" {...enter(0.1)}>
          <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
            Your study sets
          </h2>
          <span className="text-[0.74rem] font-semibold tabular-nums text-muted-foreground">
            {sets?.length ?? 0}
          </span>
          <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
        </motion.div>

        {(sets?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            {courseFilters.length > 0 && (
              <select
                value={courseFilter}
                onChange={(event) => setCourseFilter(event.target.value)}
                aria-label="Filter study sets by course"
                className="h-9 rounded-full border border-border bg-white px-3 text-[0.78rem] font-medium text-brand-ink outline-none focus:border-[#B9A6FF]"
              >
                <option value="all">All courses</option>
                {courseFilters.map(([name, count]) => (
                  <option key={name} value={name}>
                    {name} ({count})
                  </option>
                ))}
              </select>
            )}
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search study sets"
              aria-label="Search study sets"
              className="h-9 w-full rounded-full border-border bg-white text-[0.8rem] shadow-none placeholder:text-muted-foreground/60 sm:ml-auto sm:w-56"
            />
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-white">
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
                  className="mt-3 h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                >
                  Add your notes
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6">
              <p className="text-[0.82rem] text-muted-foreground">
                No sets match that search.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCourseFilter("all");
                }}
                className="text-[0.8rem] font-semibold text-brand-ink underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="rise-stagger">
              {filtered.map((set) => (
                <SetRow key={set._id} set={set} />
              ))}
            </div>
          )}
        </div>
      </section>

      <CreateSetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
