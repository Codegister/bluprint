import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
import { DeckGlyph, Mascot } from "@/components/Mascot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { readableError } from "@/lib/errors";
import { qualificationLabel } from "@/lib/examBoards";
import { displayName, percent, relativeDate, sourceLabel } from "@/lib/format";
import { courseSubtitle, subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRight,
  Camera,
  ChevronRight,
  FileUp,
  Flame,
  GraduationCap,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

type SetSummary = FunctionReturnType<typeof api.studySets.listMine>[number];
type CourseSummary = FunctionReturnType<typeof api.courses.listMine>[number];

const deckTints = [
  { solid: "#7C5CFF", tint: "bg-[#F3ECFF] text-[#5B3DF5]" },
  { solid: "#12B8A6", tint: "bg-[#E6F9F6] text-[#0E8C7F]" },
  { solid: "#F472B6", tint: "bg-[#FFF0F6] text-[#D1367E]" },
  { solid: "#FB923C", tint: "bg-[#FFF3E8] text-[#C2660F]" },
  { solid: "#3B82F6", tint: "bg-[#E9F0FF] text-[#2563EB]" },
  { solid: "#4ADE80", tint: "bg-[#EAFBF0] text-[#128A4C]" },
];

function tintFor(set: SetSummary) {
  const seed = set._id
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return deckTints[seed % deckTints.length];
}

function StatusPill({ set }: { set: SetSummary }) {
  if (set.status === "processing" || set.status === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E5] px-2.5 py-1 text-[0.7rem] font-semibold text-[#96650A]">
        <Loader2 className="size-3 animate-spin" />
        Building
      </span>
    );
  }
  if (set.status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFEEF0] px-2.5 py-1 text-[0.7rem] font-semibold text-[#C23B49]">
        Needs a retry
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAFBF0] px-2.5 py-1 text-[0.7rem] font-semibold text-[#128A4C]">
      <span className="size-1.5 rounded-full bg-[#22A06B]" />
      Ready
    </span>
  );
}

function SetCard({ set }: { set: SetSummary }) {
  const removeSet = useMutation(api.studySets.remove);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const tint = tintFor(set);
  const mastery = percent(set.knownCount, set.cardCount);
  const processing = set.status === "processing" || set.status === "queued";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removeSet({ setId: set._id });
      toast.success("Set deleted.");
      setConfirming(false);
    } catch (error) {
      toast.error(readableError(error, "Could not delete that set."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-5 transition-shadow hover:shadow-[0_16px_36px_-24px_rgba(22,24,31,0.4)]">
      <Link to={`/sets/${set._id}`} className="flex flex-1 flex-col">
        <div className="flex items-start gap-3 pr-8">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", tint.tint)}>
            <DeckGlyph className="size-6" color="currentColor" />
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-[1.02rem] font-semibold leading-snug text-brand-ink">
              {set.title}
            </h3>
            <p className="mt-1 text-[0.78rem] text-muted-foreground">
              {qualificationLabel(set) || sourceLabel(set.sourceType)} · {set.cardCount} cards
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill set={set} />
          <span className="rounded-full border border-border px-2.5 py-1 text-[0.7rem] font-medium text-muted-foreground">
            {set.quizCount} quiz · {set.examCount} exam
          </span>
          {set.status === "ready" && set.dueCount > 0 && (
            <span className="rounded-full bg-[#FFF3E8] px-2.5 py-1 text-[0.7rem] font-semibold text-[#C2660F]">
              {set.dueCount} due
            </span>
          )}
        </div>

        {set.status === "ready" ? (
          <div className="mt-auto pt-5">
            <div className="flex items-center justify-between text-[0.75rem] font-medium text-muted-foreground">
              <span>Cards known</span>
              <span className="text-brand-ink">{mastery}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-panel">
              <div
                className="h-full rounded-full bg-[#7C5CFF] transition-[width] duration-500"
                style={{ width: `${mastery}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[0.75rem] text-muted-foreground">
              <span>
                {set.lastStudiedAt
                  ? `Studied ${relativeDate(set.lastStudiedAt)}`
                  : "Not started yet"}
              </span>
              <span>
                {set.lastQuizTotal
                  ? `Quiz ${set.lastQuizScore}/${set.lastQuizTotal}`
                  : "No quiz yet"}
              </span>
            </div>
          </div>
        ) : processing ? (
          <p className="mt-auto flex items-center gap-2 pt-5 text-[0.78rem] font-medium text-[#96650A]">
            <Loader2 className="size-3.5 animate-spin" />
            {set.progress || "Waiting to start"}
          </p>
        ) : (
          <p className="mt-auto pt-5 text-[0.78rem] font-medium text-[#C23B49]">
            Open to review what went wrong and retry.
          </p>
        )}
      </Link>

      <div className="absolute right-3 top-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${set.title}`}
              className="size-8 rounded-full text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-2xl">
            <DropdownMenuItem
              onSelect={() => setConfirming(true)}
              className="cursor-pointer gap-2 text-[0.82rem] text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete set
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete “{set.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This removes the extracted notes, flashcards, quiz, exam practice and
              uploaded images. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-full">
              Keep set
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete set
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

/** One row of the Cognito-style course table. */
function CourseRow({ course }: { course: CourseSummary }) {
  const meta = subjectMeta(course.subject);
  const Icon = meta.icon;
  const mastery = percent(course.completedCount, course.topicCount);
  const building = course.status === "queued" || course.status === "processing";

  return (
    <Link
      to={`/courses/${course._id}`}
      className="group grid grid-cols-1 gap-3 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-brand-panel/40 sm:grid-cols-[minmax(0,1fr)_150px_160px_20px] sm:items-center sm:px-5"
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
                New course
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[0.76rem] text-muted-foreground">
            {courseSubtitle(course)}
          </p>
        </div>
      </div>

      <div className="pl-14 sm:pl-0">
        <p className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:hidden">
          Pathway
        </p>
        {building ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.76rem] font-medium text-[#96650A]">
            <Loader2 className="size-3 animate-spin" />
            {course.progress || "Building"}
          </p>
        ) : course.status === "error" ? (
          <p className="mt-0.5 text-[0.76rem] font-semibold text-[#C23B49]">
            Needs a retry
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
            <div className="mt-1 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-brand-panel">
              <div
                className="h-full rounded-full bg-[#7C5CFF]"
                style={{ width: `${mastery}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="pl-14 sm:pl-0">
        <p className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:hidden">
          Materials
        </p>
        {course.status === "ready" ? (
          <div className="flex items-center gap-2 text-[0.76rem] text-muted-foreground">
            <span className="font-semibold text-brand-ink">
              {course.setCount} {course.setCount === 1 ? "set" : "sets"}
            </span>
            {course.cardCount > 0 && (
              <span className="rounded-full bg-[#EAFBF0] px-2 py-0.5 text-[0.66rem] font-semibold text-[#128A4C]">
                {percent(course.knownCount, course.cardCount)}% known
              </span>
            )}
          </div>
        ) : (
          <p className="text-[0.76rem] text-muted-foreground">
            {course.status === "error" ? "Open to retry" : "Mapping specification"}
          </p>
        )}
      </div>

      <ChevronRight className="hidden size-4 shrink-0 text-brand-ink/30 transition-colors group-hover:text-brand-ink/70 sm:block" />
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const sets = useQuery(api.studySets.listMine);
  const courseRows = useQuery(api.courses.listMine);
  const ai = useQuery(api.settings.aiStatus);
  const study = useQuery(api.studySets.studyStats);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const dialogOpen = searchParams.get("new") === "1";

  const setDialogOpen = (open: boolean) => {
    setSearchParams(open ? { new: "1" } : {}, { replace: true });
  };

  const stats = useMemo(() => {
    const list = sets ?? [];
    const cards = list.reduce((sum, set) => sum + set.cardCount, 0);
    const known = list.reduce((sum, set) => sum + set.knownCount, 0);
    const scored = list.filter(
      (set) => set.lastQuizTotal && set.lastQuizTotal > 0 && set.lastQuizScore !== undefined,
    );
    const quizAverage =
      scored.length > 0
        ? Math.round(
            (scored.reduce(
              (sum, set) => sum + (set.lastQuizScore ?? 0) / (set.lastQuizTotal ?? 1),
              0,
            ) /
              scored.length) *
              100,
          )
        : null;
    const due = list.reduce((sum, set) => sum + (set.dueCount ?? 0), 0);
    return { count: list.length, mastery: percent(known, cards), cards, quizAverage, due };
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
      const matchesCourse =
        courseFilter === "all" || set.course === courseFilter;
      const matchesSearch =
        !query ||
        [set.title, set.course ?? "", set.examBoard ?? "", set.level ?? ""].some(
          (value) => value.toLowerCase().includes(query),
        );
      return matchesCourse && matchesSearch;
    });
  }, [sets, search, courseFilter]);

  const recent = useMemo(
    () =>
      [...(sets ?? [])]
        .sort((a, b) => (b.lastStudiedAt ?? b.updatedAt) - (a.lastStudiedAt ?? a.updatedAt))
        .slice(0, 3),
    [sets],
  );

  return (
    <AppShell>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.75rem] font-bold leading-tight text-brand-ink sm:text-[2rem]">
            Home
          </h1>
          <p className="mt-1 text-[0.9rem] text-muted-foreground">
            Welcome back, {displayName(user?.name, user?.email)}. What are we revising
            today?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-full border-border bg-white px-4 font-semibold text-brand-ink hover:bg-brand-panel"
          >
            <Link to="/courses/new">
              <GraduationCap className="size-4" />
              Choose courses
            </Link>
          </Button>
          <Button
            onClick={() => setDialogOpen(true)}
            className="h-10 rounded-full bg-[#191B27] px-5 font-semibold text-white hover:bg-[#2A2D3E]"
          >
            <FileUp className="size-4" />
            Upload material
          </Button>
        </div>
      </header>

      {/* Two ways in: a whole course pathway, or the student's own material. */}
      <section className="mt-7 overflow-hidden rounded-[2rem] border border-border bg-white shadow-[0_1px_2px_rgba(22,24,31,0.04),0_18px_44px_-34px_rgba(22,24,31,0.4)]">
        <div className="flex flex-col items-center gap-3 border-b border-border/70 px-5 py-6 text-center sm:flex-row sm:justify-center sm:gap-6 sm:py-7 sm:text-left">
          <Mascot size={104} className="sm:size-[124px]" />
          <div>
            <p className="text-[1rem] font-medium text-brand-ink/60">What shall we</p>
            <p className="font-display text-[2.4rem] font-extrabold leading-none tracking-[-0.04em] text-[#191B27] sm:text-[3rem]">
              Study?
            </p>
            <p className="mt-1.5 text-[0.82rem] text-muted-foreground">
              Start with your courses, or bring your own notes.
            </p>
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
          <Link
            to="/courses/new"
            className="group flex flex-col rounded-3xl border border-[#D8CCFF] bg-[#FAF8FF] p-5 transition-shadow hover:shadow-[0_16px_36px_-26px_rgba(91,61,245,0.55)]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-[#F3ECFF] text-[#5B3DF5]">
                <GraduationCap className="size-5" />
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[0.64rem] font-bold uppercase tracking-[0.08em] text-[#6B4EE6]">
                Course pathway
              </span>
            </div>
            <h2 className="mt-3 font-display text-[1.15rem] font-bold text-brand-ink">
              Revise a whole course
            </h2>
            <p className="mt-1.5 text-[0.84rem] leading-relaxed text-muted-foreground">
              Pick your exam board and every course you take. Bluprint maps the
              current specification into units and topics, then builds cards,
              quizzes and exam practice for any topic.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Specification-mapped", "All your courses", "Per-topic sets"].map(
                (chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#E4DBFF] bg-white px-2 py-1 text-[0.66rem] font-semibold text-[#6B4EE6]"
                  >
                    {chip}
                  </span>
                ),
              )}
            </div>
            <span className="mt-auto flex items-center gap-1.5 pt-4 text-[0.84rem] font-semibold text-[#5B3DF5]">
              {courseRows && courseRows.length > 0
                ? "Add another course"
                : "Choose your courses"}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="group flex flex-col rounded-3xl border border-border bg-white p-5 text-left transition-shadow hover:shadow-[0_16px_36px_-26px_rgba(14,140,127,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-[#E6F9F6] text-[#0E8C7F]">
                <FileUp className="size-5" />
              </span>
              <span className="rounded-full bg-brand-panel px-2.5 py-1 text-[0.64rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Your own material
              </span>
            </div>
            <h2 className="mt-3 font-display text-[1.15rem] font-bold text-brand-ink">
              Turn notes into a study set
            </h2>
            <p className="mt-1.5 text-[0.84rem] leading-relaxed text-muted-foreground">
              Upload photos of a page, add a video, or paste notes. Get a summary,
              flashcards, a quiz and AI-marked exam questions from exactly what
              you're studying.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Photos & video", "Summary", "Exam practice"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-border bg-white px-2 py-1 text-[0.66rem] font-semibold text-brand-ink/60"
                >
                  {chip}
                </span>
              ))}
            </div>
            <span className="mt-auto flex items-center gap-1.5 pt-4 text-[0.84rem] font-semibold text-[#0E8C7F]">
              Upload study material
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>

        {ai && !ai.configured && (
          <p className="mx-3 mb-3 rounded-2xl bg-[#FFF6E5] px-4 py-2.5 text-[0.8rem] font-medium text-[#96650A] sm:mx-4 sm:mb-4">
            AI is not connected on this deployment. Add NVIDIA_API_KEY to build new
            sets or OPENROUTER_API_KEY for course pathways — everything already saved
            still works.
          </p>
        )}
      </section>

      {courseRows && courseRows.length > 0 && (
        <section
          id="courses"
          className="mt-4 overflow-hidden rounded-[2rem] border border-border bg-white shadow-[0_18px_44px_-34px_rgba(22,24,31,0.35)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-[#191B27] text-[0.78rem] font-bold text-white">
                {courseRows.length}
              </span>
              <div>
                <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
                  Your courses
                </h2>
                <p className="text-[0.72rem] text-muted-foreground">
                  {courseRows.length} qualification{courseRows.length === 1 ? "" : "s"} · AI-mapped from your specification
                </p>
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              className="h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink hover:bg-brand-panel"
            >
              <Link to="/courses/new">
                <Plus className="size-3.5" />
                Add courses
              </Link>
            </Button>
          </div>

          <div className="hidden grid-cols-[minmax(0,1fr)_150px_160px_20px] gap-3 border-b border-border/70 bg-[#FCFCFD] px-5 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid">
            <span>Subject</span>
            <span>Pathway</span>
            <span>Materials</span>
            <span />
          </div>

          {courseRows.map((course) => (
            <CourseRow key={course._id} course={course} />
          ))}
        </section>
      )}

      {/* Progress strip */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Study sets",
            value: String(stats.count),
            hint: "Saved to your account",
            icon: Layers,
            tint: "bg-[#F3ECFF] text-[#5B3DF5]",
          },
          {
            label: "Due now",
            value: String(stats.due),
            hint: stats.due > 0 ? "Cards ready for review" : "Nothing due today",
            icon: Flame,
            tint: "bg-[#FFF3E8] text-[#C2660F]",
          },
          {
            label: "Cards known",
            value: `${stats.mastery}%`,
            hint: `${stats.cards} cards in total`,
            icon: Sparkles,
            tint: "bg-[#E6F9F6] text-[#0E8C7F]",
          },
          {
            label: "Quiz average",
            value: stats.quizAverage === null ? "—" : `${stats.quizAverage}%`,
            hint:
              stats.quizAverage === null
                ? "Take a quiz to see this"
                : "Across completed quizzes",
            icon: TrendingUp,
            tint: "bg-[#E9F0FF] text-[#2563EB]",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-4"
            >
              <span className={cn("grid size-10 place-items-center rounded-2xl", stat.tint)}>
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-[0.75rem] font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="font-display text-[1.35rem] font-bold leading-tight text-brand-ink">
                  {stat.value}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">{stat.hint}</p>
              </div>
            </div>
          );
        })}
      </section>

      {study && (
        <section className="mt-3 flex flex-col gap-3 rounded-3xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#FFF3E8] text-[#C2660F]">
              <Flame className="size-4" />
            </span>
            <div>
              <p className="text-[0.82rem] font-semibold text-brand-ink">
                Daily goal
              </p>
              <p className="text-[0.74rem] text-muted-foreground">
                {study.todayCount} of {study.goal} cards reviewed today
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:w-1/2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-panel">
              <div
                className="h-full rounded-full bg-[#F59E0B] transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, Math.round((study.todayCount / study.goal) * 100))}%`,
                }}
              />
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF3E8] px-2.5 py-1 text-[0.72rem] font-semibold text-[#C2660F]">
              <Flame className="size-3" />
              {study.streak} day{study.streak === 1 ? "" : "s"}
            </span>
          </div>
        </section>
      )}

      {sets === undefined ? (
        <div className="mt-8 flex min-h-[220px] items-center justify-center rounded-3xl border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : sets.length === 0 ? (
        <section className="mt-4 flex flex-col items-start gap-3 rounded-3xl border border-dashed border-border bg-card px-5 py-5 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#E6F9F6] text-[#0E8C7F]">
            <Layers className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[1rem] font-bold text-brand-ink">
              No study sets yet
            </h2>
            <p className="mt-0.5 text-[0.8rem] leading-relaxed text-muted-foreground">
              Build one from any course topic, or upload notes to compile a summary,
              cards, a quiz and exam practice in one go.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {courseRows && courseRows.length > 0 && (
              <Button
                asChild
                variant="outline"
                className="h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink hover:bg-brand-panel"
              >
                <Link to={`/courses/${courseRows[0]!._id}`}>Open a course</Link>
              </Button>
            )}
            <Button
              onClick={() => setDialogOpen(true)}
              className="h-9 rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
            >
              <Plus className="size-3.5" />
              Upload notes
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
                Jump back in
              </h2>
              <Link
                to="/dashboard#sets"
                className="text-[0.82rem] font-semibold text-brand-ink/60 hover:text-brand-ink"
              >
                View all
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {recent.map((set) => {
                const tint = tintFor(set);
                return (
                  <Link
                    key={set._id}
                    to={`/sets/${set._id}`}
                    className="flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-4 transition-shadow hover:shadow-[0_14px_30px_-24px_rgba(22,24,31,0.45)]"
                  >
                    <DeckGlyph className="size-7" color={tint.solid} />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[0.92rem] font-semibold leading-snug text-brand-ink">
                        {set.title}
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                        {set.cardCount} cards · {set.status === "ready" ? "Ready" : "Building"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section id="sets" className="mt-8 scroll-mt-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
                  Your study sets
                </h2>
                <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
                  {sets.length} {sets.length === 1 ? "set" : "sets"} saved to your account
                </p>
              </div>
              <Button
                onClick={() => setDialogOpen(true)}
                variant="outline"
                className="h-9 rounded-full border-border bg-white px-4 text-[0.82rem] font-semibold text-brand-ink hover:bg-brand-panel"
              >
                <Camera className="size-3.5" />
                Add set
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCourseFilter("all")}
                  aria-pressed={courseFilter === "all"}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[0.76rem] font-semibold transition-colors",
                    courseFilter === "all"
                      ? "border-[#191B27] bg-[#191B27] text-white"
                      : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                  )}
                >
                  All courses
                </button>
                {courseFilters.map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCourseFilter(name)}
                    aria-pressed={courseFilter === name}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[0.76rem] font-semibold transition-colors",
                      courseFilter === name
                        ? "border-[#7C5CFF] bg-[#F3ECFF] text-[#5B3DF5]"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {name}
                    <span className="ml-1.5 text-[0.68rem] opacity-60">{count}</span>
                  </button>
                ))}
              </div>

              <div className="relative w-full lg:w-60">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search sets, courses or boards"
                  aria-label="Search study sets"
                  className="h-10 rounded-full border-border bg-white pl-9 text-sm shadow-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="mt-3 rounded-3xl border border-dashed border-border bg-card px-6 py-10 text-center">
                <p className="font-display text-[1.05rem] font-bold text-brand-ink">
                  No sets match that filter
                </p>
                <p className="mt-1 text-[0.8rem] text-muted-foreground">
                  Try another course or clear the search.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCourseFilter("all");
                  }}
                  className="mt-3 rounded-full border border-border bg-white px-4 py-1.5 text-[0.8rem] font-semibold text-brand-ink hover:bg-brand-panel"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((set) => (
                  <SetCard key={set._id} set={set} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <CreateSetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
