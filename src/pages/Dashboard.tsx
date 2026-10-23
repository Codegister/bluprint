import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
import { Pip } from "@/components/Pip";
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
import { Badge } from "@/components/ui/badge";
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
import {
  displayName,
  percent,
  relativeDate,
  sourceLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  KeyRound,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

type SetSummary = FunctionReturnType<typeof api.studySets.listMine>[number];

const sourceStyles: Record<
  SetSummary["sourceType"],
  { icon: typeof Camera; tint: string; bar: string }
> = {
  photos: { icon: Camera, tint: "bg-brand-pink/30", bar: "bg-brand-pink" },
  video: { icon: Video, tint: "bg-brand-sky/70", bar: "bg-brand-sky" },
  text: { icon: FileText, tint: "bg-brand-mint/70", bar: "bg-brand-mint" },
};

function StatusBadge({ set }: { set: SetSummary }) {
  if (set.status === "processing" || set.status === "queued") {
    return (
      <Badge className="gap-1 border border-brand-ink/10 bg-brand-lime/60 text-brand-ink hover:bg-brand-lime/60">
        <Loader2 className="size-3 animate-spin" />
        {set.status === "queued" ? "Queued" : "Building"}
      </Badge>
    );
  }
  if (set.status === "error") {
    return (
      <Badge className="gap-1 border border-brand-ink/10 bg-brand-peach text-brand-ink hover:bg-brand-peach">
        <RefreshCw className="size-3" />
        Needs retry
      </Badge>
    );
  }
  return null;
}

function SetCard({ set }: { set: SetSummary }) {
  const removeSet = useMutation(api.studySets.remove);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const style = sourceStyles[set.sourceType];
  const SourceIcon = style.icon;
  const mastery = percent(set.knownCount, set.cardCount);
  const processing = set.status === "processing" || set.status === "queued";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removeSet({ setId: set._id });
      toast.success("Study set deleted.");
      setConfirming(false);
    } catch (error) {
      toast.error(readableError(error, "Could not delete that set."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-brand-ink/10 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-ink/25">
      <div className={cn("h-1.5 w-full", style.bar)} />

      <Link to={`/sets/${set._id}`} className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2.5 pr-8">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl border border-brand-ink/10",
              style.tint,
            )}
          >
            <SourceIcon className="size-4 text-brand-ink" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-ink/40">
              {sourceLabel(set.sourceType)}
            </p>
            <p className="text-[11px] font-medium text-brand-ink/45">
              {set.lastStudiedAt
                ? `Studied ${relativeDate(set.lastStudiedAt)}`
                : `Updated ${relativeDate(set.updatedAt)}`}
            </p>
          </div>
        </div>

        <h3 className="mt-4 line-clamp-2 min-h-[3.1rem] font-display text-[1.05rem] font-bold leading-snug text-brand-ink">
          {set.title}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-brand-cream px-2 py-1 text-[10.5px] font-semibold text-brand-ink/60">
            {set.cardCount} cards
          </span>
          <span className="rounded-full bg-brand-cream px-2 py-1 text-[10.5px] font-semibold text-brand-ink/60">
            {set.quizCount} quiz
          </span>
          <span className="rounded-full bg-brand-cream px-2 py-1 text-[10.5px] font-semibold text-brand-ink/60">
            {set.examCount} exam
          </span>
          <StatusBadge set={set} />
        </div>

        {set.status === "ready" && (
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between text-[10.5px] font-semibold text-brand-ink/45">
              <span>Cards mastered</span>
              <span>{mastery}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/10">
              <div
                className="h-full rounded-full bg-brand-mint transition-all"
                style={{ width: `${mastery}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-brand-ink/40">
                {set.lastQuizTotal
                  ? `Last quiz ${set.lastQuizScore}/${set.lastQuizTotal}`
                  : "Quiz not taken yet"}
              </span>
              <span className="grid size-7 place-items-center rounded-full border border-brand-ink/10 bg-brand-cream text-brand-ink transition group-hover:bg-brand-pink">
                <ArrowRight className="size-3.5" />
              </span>
            </div>
          </div>
        )}

        {processing && (
          <div className="mt-auto flex items-center gap-2 pt-4 text-[11px] font-semibold text-brand-ink/50">
            <Sparkles className="size-3.5 text-brand-pink-deep" />
            {set.progress || "Waiting for Pip…"}
          </div>
        )}

        {set.status === "error" && (
          <div className="mt-auto flex items-center gap-2 pt-4 text-[11px] font-semibold text-destructive">
            <RefreshCw className="size-3.5" />
            Open to retry
          </div>
        )}
      </Link>

      <div className="absolute right-3 top-5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${set.title}`}
              className="rounded-lg text-brand-ink/40 hover:bg-brand-ink/5 hover:text-brand-ink"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onSelect={() => setConfirming(true)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete set
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete “{set.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the notes, flashcards, quiz and exam practice, plus the uploaded
              images. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
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

export default function Dashboard() {
  const { user } = useAuth();
  const sets = useQuery(api.studySets.listMine);
  const ai = useQuery(api.settings.aiStatus);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
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
    return {
      count: list.length,
      mastery: percent(known, cards),
      cards,
      quizAverage,
    };
  }, [sets]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sets ?? [];
    return (sets ?? []).filter((set) => set.title.toLowerCase().includes(query));
  }, [sets, search]);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink/40">
            <span className="size-1.5 rounded-full bg-brand-pink-deep" />
            Welcome back, {displayName(user?.name, user?.email)}
          </p>
          <h1 className="display-tight mt-2 text-[2rem] font-bold leading-none sm:text-[2.5rem]">
            My study sets
          </h1>
          <p className="mt-2 text-[13px] text-brand-ink/50">
            Everything Pip builds stays here between sessions.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="h-11 w-full rounded-xl border-2 border-brand-ink bg-brand-pink px-5 font-bold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream sm:w-auto"
        >
          <Plus className="size-4" />
          New study set
        </Button>
      </div>

      {ai && !ai.configured && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-brand-lime bg-brand-lime/50 p-4 sm:flex-row sm:items-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-ink/10 bg-white">
            <KeyRound className="size-4 text-brand-ink" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-brand-ink">
              Pip needs an NVIDIA key before it can generate.
            </p>
            <p className="text-[12px] text-brand-ink/55">
              Add NVIDIA_API_KEY once and it's ready for everyone on this deployment.
            </p>
          </div>
          <Button
            asChild
            className="h-9 shrink-0 rounded-xl border-2 border-brand-ink bg-brand-ink px-4 text-xs font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
          >
            <Link to="/setup">Open AI setup</Link>
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Study sets",
            value: String(stats.count),
            hint: "Private to your account",
            icon: <Layers className="size-4" />,
            tint: "bg-brand-mint/60",
          },
          {
            label: "Cards mastered",
            value: `${stats.mastery}%`,
            hint: `${stats.cards} cards in total`,
            icon: <CheckCircle2 className="size-4" />,
            tint: "bg-brand-sky/60",
          },
          {
            label: "Quiz average",
            value: stats.quizAverage === null ? "—" : `${stats.quizAverage}%`,
            hint: stats.quizAverage === null ? "Take a quiz to start" : "Across finished quizzes",
            icon: <Trophy className="size-4" />,
            tint: "bg-brand-pink/40",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3.5 rounded-2xl border border-brand-ink/10 bg-card p-4"
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl border border-brand-ink/10 text-brand-ink",
                stat.tint,
              )}
            >
              {stat.icon}
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl font-bold leading-none text-brand-ink">
                {stat.value}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-brand-ink/55">{stat.label}</p>
              <p className="hidden text-[10px] text-brand-ink/35 sm:block">{stat.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Your sets</h2>
          <p className="text-[11px] text-brand-ink/45">
            {sets === undefined
              ? "Loading your sets…"
              : `${sets.length} set${sets.length === 1 ? "" : "s"} saved`}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-ink/35" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your sets"
            className="h-10 rounded-xl border-brand-ink/15 bg-white pl-9 text-sm"
          />
        </div>
      </div>

      {sets === undefined ? (
        <div className="mt-8 flex min-h-[220px] items-center justify-center rounded-2xl border border-brand-ink/10 bg-card">
          <Loader2 className="size-5 animate-spin text-brand-ink/40" />
        </div>
      ) : filtered.length === 0 && sets.length > 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-brand-ink/15 bg-card px-6 py-12 text-center">
          <p className="font-display text-lg font-bold text-brand-ink">No sets match “{search}”</p>
          <p className="mt-1 text-[12px] text-brand-ink/45">
            Try a different word, or clear the search.
          </p>
          <Button
            variant="ghost"
            className="mt-3 rounded-xl font-semibold"
            onClick={() => setSearch("")}
          >
            Clear search
          </Button>
        </div>
      ) : sets.length === 0 ? (
        <div className="relative mt-8 overflow-hidden rounded-[26px] border border-dashed border-brand-ink/20 bg-white/60 px-6 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute inset-0 paper-dots opacity-50" />
          <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <div className="grid size-32 shrink-0 place-items-center rounded-[32px] border-2 border-brand-ink bg-brand-mint">
              <Pip size={104} className="animate-pip-float" cap />
            </div>
            <div className="max-w-md">
              <h2 className="font-display text-2xl font-bold">No sets yet — your notes are waiting.</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-brand-ink/55">
                Upload photos, sample a video or paste text. Pip will build a summary, ten
                flashcards, a five-question quiz and three exam questions.
              </p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="mt-5 h-10 rounded-xl border-2 border-brand-ink bg-brand-pink px-5 font-bold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream"
              >
                <Plus className="size-4" />
                Create my first set
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((set) => (
            <SetCard key={set._id} set={set} />
          ))}
        </div>
      )}

      <CreateSetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
