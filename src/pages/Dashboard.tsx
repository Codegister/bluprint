import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
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
import { ChevronRight, Loader2 } from "lucide-react";
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
      className="group flex items-center gap-4 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-brand-panel/40 sm:px-5"
    >
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
            <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-brand-panel">
              <div
                className="h-full rounded-full"
                style={{ width: `${mastery}%`, backgroundColor: accent }}
              />
            </div>
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
      className="group grid grid-cols-1 gap-3 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-brand-panel/40 sm:grid-cols-[minmax(0,1fr)_170px_160px_16px] sm:items-center sm:px-5"
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
            <div className="mt-1.5 h-1.5 w-full max-w-[130px] overflow-hidden rounded-full bg-brand-panel">
              <div
                className="h-full rounded-full"
                style={{ width: `${mastery}%`, backgroundColor: meta.color }}
              />
            </div>
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2rem]">
            Home
          </h1>
          <p className="mt-1 text-[0.9rem] text-muted-foreground">
            Welcome back, {displayName(user?.name, user?.email)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-full border-border bg-white px-5 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
          >
            <Link to="/timetable/new">Build revision timetable</Link>
          </Button>
          <Button
            onClick={() => setDialogOpen(true)}
            className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E]"
          >
            New study set
          </Button>
        </div>
      </header>

      <div className="mt-5 grid overflow-hidden rounded-2xl border border-border bg-white sm:grid-cols-3">
        <div className="px-4 py-3.5 sm:px-5">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Study sets
          </p>
          <p className="mt-1 font-display text-[1.4rem] font-bold leading-none text-brand-ink">
            {sets?.length ?? 0}
          </p>
        </div>
        <div className="border-t border-border px-4 py-3.5 sm:border-l sm:border-t-0 sm:px-5">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Cards known
          </p>
          <p className="mt-1 font-display text-[1.4rem] font-bold leading-none text-brand-ink">
            {stats.mastery}%
          </p>
        </div>
        <div className="border-t border-border px-4 py-3.5 sm:border-l sm:border-t-0 sm:px-5">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Due now
          </p>
          <p className="mt-1 font-display text-[1.4rem] font-bold leading-none text-brand-ink">
            {stats.due}
            {study && (
              <span className="ml-2 text-[0.68rem] font-medium text-muted-foreground">
                {study.todayCount}/{study.goal} reviewed today
              </span>
            )}
          </p>
        </div>
      </div>

      {ai && !ai.configured && (
        <p className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-2.5 text-[0.8rem] font-medium text-[#96650A]">
          AI is not connected on this deployment. Add NVIDIA_API_KEY to build new
          study sets. Pathways are scraped and saved material still works.
        </p>
      )}

      <section id="tutor" className="mt-8 scroll-mt-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
            AI tutor
          </h2>
          <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
        </div>
        <p className="mt-1 max-w-2xl text-[0.82rem] leading-relaxed text-muted-foreground">
          Explain an idea, quiz yourself, or ask where marks are usually lost.
          Answers come from the course you pick, and web search stays off unless
          you turn it on.
        </p>

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
        <div className="flex items-center gap-3">
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
        </div>

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
              {courseRows.map((course) => (
                <CourseRow key={course._id} course={course} />
              ))}
            </>
          )}
        </div>
      </section>

      <section id="sets" className="mt-8 scroll-mt-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
            Study sets
          </h2>
          <span className="text-[0.74rem] font-semibold tabular-nums text-muted-foreground">
            {sets?.length ?? 0}
          </span>
          <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
        </div>

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
            <p className="px-5 py-6 text-[0.82rem] leading-relaxed text-muted-foreground">
              No study sets yet. Upload notes or open a topic in one of your courses
              to build your first set.
            </p>
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
            filtered.map((set) => <SetRow key={set._id} set={set} />)
          )}
        </div>
      </section>

      <CreateSetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
