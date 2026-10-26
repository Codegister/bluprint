import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
import { DeckGlyph, Mascot } from "@/components/Mascot";
import {
  Counter,
  EASE,
  Meter,
  enter,
  reveal,
} from "@/components/motion/Motion";
import { TutorChat } from "@/components/study/TutorChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { qualificationLabel } from "@/lib/examBoards";
import { displayName, percent, relativeDate } from "@/lib/format";
import { courseSubtitle, subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarPlus,
  ChevronRight,
  Flame,
  GraduationCap,
  Layers3,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

type SetSummary = FunctionReturnType<typeof api.studySets.listMine>[number];
type CourseSummary = FunctionReturnType<typeof api.courses.listMine>[number];

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
  const mastery = percent(set.knownCount, set.cardCount);
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
              value={mastery}
              className="h-1.5 w-full max-w-[180px]"
              barStyle={{ backgroundColor: accent }}
              label={`${set.title} mastery`}
            />
            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
              {mastery}% known
            </span>
          </div>
        )}
      </div>

      <div className="hidden w-36 shrink-0 text-right text-[0.74rem] text-muted-foreground sm:block">
        {set.status === "ready" ? (
          <>
            <p className="font-medium text-brand-ink">
              {set.lastQuizTotal
                ? `${set.lastQuizScore}/${set.lastQuizTotal} last quiz`
                : "No quiz yet"}
            </p>
            <p className="mt-0.5">
              {set.lastStudiedAt
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

/** One row of the course table. */
function CourseRow({ course }: { course: CourseSummary }) {
  const meta = subjectMeta(course.subject);
  const Icon = meta.icon;
  const mastery = percent(course.completedCount, course.topicCount);
  const building = course.status === "queued" || course.status === "processing";

  return (
    <Link
      to={`/courses/${course._id}`}
      className="group grid grid-cols-1 gap-3 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-[#F7FCFA] sm:grid-cols-[minmax(0,1fr)_170px_160px_16px] sm:items-center sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", meta.tint)}
          style={{ color: meta.color }}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-display text-[0.98rem] font-bold text-brand-ink">
              {course.subject}
            </h3>
            {course.isNew && (
              <span className="rounded-full bg-[#3B82F6] px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.04em] text-white">
                New
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[0.76rem] text-muted-foreground">
            {courseSubtitle(course)}
          </p>
        </div>
      </div>

      <div>
        {building ? (
          <p className="flex items-center gap-1.5 text-[0.76rem] font-medium text-[#96650A]">
            <Loader2 className="size-3 animate-spin" />
            {course.progress || "Building"}
          </p>
        ) : course.status === "error" ? (
          <p className="flex items-center gap-1.5 text-[0.76rem] font-medium text-[#96650A]">
            <Loader2 className="size-3 animate-spin" /> Finishing map
          </p>
        ) : (
          <>
            <p className="text-[0.8rem] font-semibold text-brand-ink">
              {course.completedCount}
              <span className="font-normal text-muted-foreground">
                {" "}
                / {course.topicCount} topics
              </span>
            </p>
            <Meter
              value={mastery}
              className="mt-1.5 h-1.5 w-full max-w-[130px]"
              barStyle={{ backgroundColor: meta.color }}
              label={`${course.subject} pathway progress`}
            />
          </>
        )}
      </div>

      <div>
        {course.status === "ready" ? (
          <div className="flex items-center gap-2 text-[0.76rem] text-muted-foreground">
            <span className="font-semibold text-brand-ink">
              {course.setCount} {course.setCount === 1 ? "set" : "sets"}
            </span>
            {course.cardCount > 0 && (
              <span className="text-[0.72rem]">
                {percent(course.knownCount, course.cardCount)}% known
              </span>
            )}
          </div>
        ) : (
          <p className="text-[0.76rem] text-muted-foreground">
            {course.status === "error" ? "Preparing pathway" : "Mapping specification"}
          </p>
        )}
      </div>

      <ChevronRight className="hidden size-4 text-brand-ink/30 transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const sets = useQuery(api.studySets.listMine);
  const courseRows = useQuery(api.courses.listMine);
  // Undefined while the query is in flight, so the notice below only renders
  // once the server has actually said the key is missing.
  const ai = useQuery(api.settings.aiStatus);
  const study = useQuery(api.studySets.studyStats);
  const recoverCourses = useMutation(api.courses.recoverMine);
  const recoveryRequested = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Sidebar links point at dashboard sections. Scrolling here means the
  // anchor works even when the click only changes the hash.
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [tutorCourseId, setTutorCourseId] = useState<string | null>(null);
  const dialogOpen = searchParams.get("new") === "1";

  const setDialogOpen = (open: boolean) => {
    setSearchParams(open ? { new: "1" } : {}, { replace: true });
  };

  useEffect(() => {
    if (!location.hash) return;
    document
      .getElementById(location.hash.slice(1))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  // Recover courses left failed by an older build. This runs once per page
  // load and means the student never has to press a retry button.
  useEffect(() => {
    if (!courseRows) return;
    const now = Date.now();
    const needsRecovery = courseRows.some(
      (course) =>
        course.status === "error" ||
        (course.status === "processing" &&
          (course.processingStartedAt === undefined ||
            now - course.processingStartedAt > 10 * 60 * 1000)),
    );
    if (!needsRecovery) {
      recoveryRequested.current = false;
      return;
    }
    if (recoveryRequested.current) return;
    recoveryRequested.current = true;
    void recoverCourses().catch(() => {
      recoveryRequested.current = false;
    });
  }, [courseRows, recoverCourses]);

  const stats = useMemo(() => {
    const list = sets ?? [];
    const cards = list.reduce((sum, set) => sum + set.cardCount, 0);
    const known = list.reduce((sum, set) => sum + set.knownCount, 0);
    const due = list.reduce((sum, set) => sum + (set.dueCount ?? 0), 0);
    return { mastery: percent(known, cards), due };
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

  // The dashboard tutor answers from one of your finished courses. Only a
  // course with a saved pathway has material to ground an answer in.
  const readyCourses = useMemo(
    () => (courseRows ?? []).filter((course) => course.status === "ready"),
    [courseRows],
  );
  const tutorCourse =
    readyCourses.find((course) => course._id === tutorCourseId) ?? readyCourses[0];

  // Religious Studies is supported as Edexcel GCSE Religious Studies A and B.
  const rsDescription =
    "Pick what you study. Bluprint maps each course from its published specification, then builds revision material for every topic. Religious Studies is split into Edexcel Religious Studies A and B, and the religions and units you study.";

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
        className="hero-wash relative overflow-hidden rounded-[2rem] border border-[#E7DCF8] px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7"
        {...enter(0.04, 14)}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="blob -right-12 -top-20 size-52 bg-white/70" />
          <div className="blob -bottom-24 left-[26%] size-48 bg-[#FFE6A3]/60" />
        </div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="sticker bg-white/85 text-[#5B3DF5]">
              <Sparkles className="size-3" aria-hidden />
              Today's revision
            </span>
            <h1 className="mt-3 font-display text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-brand-ink sm:text-[2.2rem]">
              Welcome back,{" "}
              <span className="text-gradient">
                {displayName(user?.name, user?.email)}
              </span>
            </h1>
            <p className="mt-2 max-w-md text-[0.9rem] leading-relaxed text-brand-ink/65">
              {stats.due > 0
                ? `${stats.due} ${stats.due === 1 ? "card is" : "cards are"} ready for review. A short session now keeps the streak alive.`
                : "Nothing is due right now. Start a new set from your notes or revisit an old one."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setDialogOpen(true)}
                className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white shadow-[0_14px_24px_-18px_rgba(25,27,39,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-[#2A2D3E]"
              >
                New study set
                <ArrowRight className="size-4" />
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-white/90 bg-white/75 px-4 text-sm font-semibold text-brand-ink shadow-none backdrop-blur hover:bg-white"
              >
                <Link to="/timetable/new">
                  <CalendarPlus className="size-4 text-[#2B7FB8]" />
                  Build revision timetable
                </Link>
              </Button>
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

        <div className="relative mt-5 grid gap-2.5 sm:grid-cols-3">
          {[
            {
              label: "Study sets",
              count: sets?.length ?? 0,
              suffix: "",
              note: "saved to your account",
              icon: Layers3,
              tint: "bg-[#EFEDFF] text-[#5B3DF5]",
            },
            {
              label: "Cards known",
              count: stats.mastery,
              suffix: "%",
              note: "across every set",
              icon: Target,
              tint: "bg-[#E3F8F0] text-[#128A4C]",
            },
            {
              label: "Due now",
              count: stats.due,
              suffix: "",
              note: study
                ? `${study.todayCount}/${study.goal} reviewed today`
                : "cards to revisit",
              icon: Flame,
              tint: "bg-[#FFF0DC] text-[#B4720E]",
            },
          ].map((tile, index) => (
            <motion.div
              key={tile.label}
              className="lift flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 p-3 backdrop-blur"
              {...enter(0.2 + index * 0.07, 12)}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  tile.tint,
                )}
              >
                <tile.icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-brand-ink/45">
                  {tile.label}
                </p>
                <p className="mt-0.5 flex items-baseline gap-1.5 font-display text-[1.3rem] font-bold leading-none text-brand-ink">
                  <Counter value={tile.count} suffix={tile.suffix} />
                  <span className="truncate text-[0.68rem] font-medium text-brand-ink/45">
                    {tile.note}
                  </span>
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.header>

      {ai && !ai.configured && (
        <p className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-2.5 text-[0.8rem] font-medium text-[#96650A]">
          AI is not connected on this deployment. Add NVIDIA_API_KEY to build new
          study sets. Pathways are scraped and saved material still works.
        </p>
      )}

      <section id="tutor" className="mt-8 scroll-mt-6">
        <motion.div className="flex items-center gap-2.5" {...reveal()}>
          <span className="grid size-7 place-items-center rounded-lg bg-[#FFE7F0] text-[#C43F69]">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
            AI tutor
          </h2>
          <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
        </motion.div>
        <motion.p
          className="mt-1 max-w-2xl text-[0.82rem] leading-relaxed text-muted-foreground"
          {...reveal(0.06)}
        >
          Explain an idea, quiz yourself, or ask where marks are usually lost.
          Answers come from the course you pick, and web search stays off unless
          you turn it on.
        </motion.p>

        {courseRows === undefined ? (
          <div className="mt-3 flex min-h-[120px] items-center justify-center rounded-3xl border border-border bg-white">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !tutorCourse ? (
          <div className="mt-3 rounded-3xl border border-dashed border-border bg-white px-5 py-6">
            <p className="text-[0.82rem] leading-relaxed text-muted-foreground">
              The tutor works from a course pathway. Set up your subjects first,
              then ask away.
            </p>
            <Button
              asChild
              className="mt-3 h-9 rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
            >
              <Link to="/courses/new">Set up courses</Link>
            </Button>
          </div>
        ) : (
          <>
            {readyCourses.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {readyCourses.map((course) => (
                  <button
                    key={course._id}
                    type="button"
                    aria-pressed={course._id === tutorCourse._id}
                    onClick={() => setTutorCourseId(course._id)}
                    className={cn(
                      "h-8 rounded-full border px-3 text-[0.74rem] font-semibold transition-colors",
                      course._id === tutorCourse._id
                        ? "border-[#191B27] bg-[#191B27] text-white"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {course.subject}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3">
              <TutorChat
                key={tutorCourse._id}
                scope={{ kind: "course", courseId: tutorCourse._id }}
                title={tutorCourse.subject}
                qualification={courseSubtitle(tutorCourse)}
              />
            </div>
            <p className="mt-2 text-[0.72rem] text-muted-foreground">
              <Link
                to={`/tutor?course=${tutorCourse._id}`}
                className="font-semibold text-[#5B3DF5] underline-offset-2 hover:underline"
              >
                Open the tutor in full screen
              </Link>
            </p>
          </>
        )}
      </section>

      <section id="courses" className="mt-8 scroll-mt-6">
        <motion.div className="flex items-center gap-2.5" {...reveal()}>
          <span className="grid size-7 place-items-center rounded-lg bg-[#E3F8F0] text-[#128A4C]">
            <GraduationCap className="size-4" aria-hidden />
          </span>
          <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
            Courses
          </h2>
          <span className="text-[0.74rem] font-semibold tabular-nums text-muted-foreground">
            {courseRows?.length ?? 0}
          </span>
          <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
          <Button
            asChild
            variant="outline"
            className="ml-auto h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
          >
            <Link to="/courses/new">
              {courseRows && courseRows.length > 0 ? "Add courses" : "Choose courses"}
            </Link>
          </Button>
        </motion.div>

        <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-white">
          {courseRows === undefined ? (
            <div className="flex min-h-[120px] items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : courseRows.length === 0 ? (
            <p className="px-5 py-6 text-[0.82rem] leading-relaxed text-muted-foreground">
              No courses yet. Choose your qualification and subjects to get a
              revision pathway built from each published specification.
            </p>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_170px_160px_16px] gap-3 border-b border-border bg-background px-5 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid">
                <span>Subject</span>
                <span>Pathway</span>
                <span>Materials</span>
                <span />
              </div>
              <div className="rise-stagger">
                {courseRows.map((course) => (
                  <CourseRow key={course._id} course={course} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section id="sets" className="mt-8 scroll-mt-6">
        <motion.div className="flex items-center gap-2.5" {...reveal()}>
          <span className="grid size-7 place-items-center rounded-lg bg-[#FFF0DC] text-[#B4720E]">
            <Layers3 className="size-4" aria-hidden />
          </span>
          <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
            Study sets
          </h2>
          <span className="text-[0.74rem] font-semibold tabular-nums text-muted-foreground">
            {sets?.length ?? 0}
          </span>
          <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
        </motion.div>

        {(sets?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
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
              className="h-9 w-full rounded-full border-border bg-white text-[0.8rem] shadow-none placeholder:text-muted-foreground/60 sm:w-56"
            />
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-white">
          {sets === undefined ? (
            <div className="flex min-h-[130px] items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
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
                  className="mt-3 h-9 rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
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
