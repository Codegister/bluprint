import { AppShell } from "@/components/AppShell";
import { BlueprintGlyph } from "@/components/BlueprintMark";
import { CreateSetDialog } from "@/components/CreateSetDialog";
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
import { displayName, percent, relativeDate, sourceLabel } from "@/lib/format";
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
  { icon: typeof Camera; tint: string; bar: string; label: string }
> = {
  photos: {
    icon: Camera,
    tint: "border-brand-pink/25 bg-brand-pink/10 text-brand-pink",
    bar: "bg-brand-pink",
    label: "PHOTOS",
  },
  video: {
    icon: Video,
    tint: "border-brand-sky/25 bg-brand-sky/10 text-brand-sky",
    bar: "bg-brand-sky",
    label: "VIDEO",
  },
  text: {
    icon: FileText,
    tint: "border-brand-mint/25 bg-brand-mint/10 text-brand-mint",
    bar: "bg-brand-mint",
    label: "TEXT",
  },
};

function StatusBadge({ set }: { set: SetSummary }) {
  if (set.status === "processing" || set.status === "queued") {
    return (
      <Badge className="gap-1 rounded border border-brand-lime/25 bg-brand-lime/10 px-1.5 py-0 font-mono text-[9px] font-medium tracking-wide text-brand-lime hover:bg-brand-lime/10">
        <Loader2 className="size-2.5 animate-spin" />
        {set.status === "queued" ? "QUEUED" : "COMPILING"}
      </Badge>
    );
  }
  if (set.status === "error") {
    return (
      <Badge className="gap-1 rounded border border-brand-peach/25 bg-brand-peach/10 px-1.5 py-0 font-mono text-[9px] font-medium tracking-wide text-brand-peach hover:bg-brand-peach/10">
        <RefreshCw className="size-2.5" />
        FAILED
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 rounded border border-brand-mint/20 bg-brand-mint/[0.06] px-1.5 py-0 font-mono text-[9px] font-medium tracking-wide text-brand-mint hover:bg-brand-mint/[0.06]">
      <span className="size-1.5 rounded-full bg-brand-mint" />
      READY
    </Badge>
  );
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
      toast.success("Set deleted.");
      setConfirming(false);
    } catch (error) {
      toast.error(readableError(error, "Could not delete that set."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-brand-pink/25">
      <div className={cn("h-px w-full opacity-70", style.bar)} />

      <Link to={`/sets/${set._id}`} className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center gap-2.5 pr-7">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-md border",
              style.tint,
            )}
          >
            <SourceIcon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
              {style.label}
            </p>
            <p className="mt-0.5 font-mono text-[9.5px] text-muted-foreground/70">
              {set.lastStudiedAt
                ? `STUDIED ${relativeDate(set.lastStudiedAt).toUpperCase()}`
                : `UPDATED ${relativeDate(set.updatedAt).toUpperCase()}`}
            </p>
          </div>
        </div>

        <h3 className="mt-4 line-clamp-2 min-h-[2.9rem] font-display text-[1.05rem] font-semibold leading-snug text-brand-ink">
          {set.title}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge set={set} />
          <span className="rounded border border-border bg-brand-panel px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            {set.cardCount} CARDS
          </span>
          <span className="rounded border border-border bg-brand-panel px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            {set.quizCount} QUIZ
          </span>
          <span className="rounded border border-border bg-brand-panel px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            {set.examCount} EXAM
          </span>
        </div>

        {set.status === "ready" ? (
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wide text-muted-foreground">
              <span>CARDS KNOWN</span>
              <span>{mastery}%</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-brand-mint"
                style={{ width: `${mastery}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[9.5px] text-muted-foreground/80">
                {set.lastQuizTotal
                  ? `LAST QUIZ ${set.lastQuizScore}/${set.lastQuizTotal}`
                  : "QUIZ NOT TAKEN"}
              </span>
              <span className="grid size-6 place-items-center rounded border border-border bg-brand-panel text-muted-foreground transition-colors group-hover:border-brand-pink/30 group-hover:bg-brand-pink/10 group-hover:text-brand-pink">
                <ArrowRight className="size-3" />
              </span>
            </div>
          </div>
        ) : processing ? (
          <div className="mt-auto flex items-center gap-2 pt-4 font-mono text-[9.5px] text-brand-lime/80">
            <Loader2 className="size-3 animate-spin" />
            {set.progress?.toUpperCase() || "WAITING FOR RUN"}
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-2 pt-4 font-mono text-[9.5px] text-brand-peach/80">
            <RefreshCw className="size-3" />
            OPEN TO RETRY
          </div>
        )}
      </Link>

      <div className="absolute right-2 top-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${set.title}`}
              className="size-7 rounded text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 border-border bg-popover">
            <DropdownMenuItem
              onSelect={() => setConfirming(true)}
              className="cursor-pointer font-mono text-[10.5px] text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete set
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="rounded-xl border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete “{set.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This removes the extracted notes, flashcards, quiz, exam practice and uploaded
              images. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-md border-border">
              Keep set
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="rounded-md bg-destructive text-brand-void hover:bg-destructive/90"
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
          <p className="mono-label flex items-center gap-2 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand-pink" />
            WORKSPACE / {displayName(user?.name, user?.email)}
          </p>
          <h1 className="display-tight mt-2.5 text-[2rem] font-semibold leading-none sm:text-[2.4rem]">
            My study sets
          </h1>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Everything you've compiled, with card progress and quiz scores saved to your
            account.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="h-10 w-full rounded-md bg-brand-pink px-4 font-mono text-[11px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep sm:w-auto"
        >
          <Plus className="size-3.5" />
          New set
        </Button>
      </div>

      {ai && !ai.configured && (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-brand-lime/25 bg-brand-lime/[0.05] p-4 sm:flex-row sm:items-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-brand-lime/25 bg-brand-lime/10">
            <KeyRound className="size-4 text-brand-lime" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mono-label text-brand-lime">MODEL ACCESS REQUIRED</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Add NVIDIA_API_KEY to the deployment environment to compile new sets.
              Existing sets stay available.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "SETS",
            value: String(stats.count),
            hint: "IN YOUR WORKSPACE",
            icon: <Layers className="size-4" />,
            tint: "text-brand-pink",
          },
          {
            label: "CARDS KNOWN",
            value: `${stats.mastery}%`,
            hint: `${stats.cards} CARDS TOTAL`,
            icon: <CheckCircle2 className="size-4" />,
            tint: "text-brand-mint",
          },
          {
            label: "QUIZ AVERAGE",
            value: stats.quizAverage === null ? "—" : `${stats.quizAverage}%`,
            hint:
              stats.quizAverage === null
                ? "NO COMPLETED QUIZZES"
                : "ACROSS COMPLETED QUIZZES",
            icon: <Trophy className="size-4" />,
            tint: "text-brand-sky",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <p className="mono-label text-muted-foreground">{stat.label}</p>
              <span className={stat.tint}>{stat.icon}</span>
            </div>
            <p className="mt-2 font-display text-2xl font-semibold leading-none text-brand-ink">
              {stat.value}
            </p>
            <p className="mt-1.5 font-mono text-[9px] tracking-[0.1em] text-muted-foreground/70">
              {stat.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Saved sets</h2>
          <p className="mt-0.5 font-mono text-[9.5px] tracking-[0.1em] text-muted-foreground">
            {sets === undefined
              ? "LOADING…"
              : `${sets.length} SET${sets.length === 1 ? "" : "S"} / PRIVATE`}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter sets"
            className="h-9 rounded-md border-border bg-brand-panel pl-9 font-mono text-[11px] text-brand-ink placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {sets === undefined ? (
        <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 && sets.length > 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold text-brand-ink">
            No sets match “{search}”
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            FILTER RETURNED 0 RESULTS
          </p>
          <Button
            variant="ghost"
            className="mt-3 rounded-md font-mono text-[10px] tracking-wide text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
            onClick={() => setSearch("")}
          >
            CLEAR FILTER
          </Button>
        </div>
      ) : sets.length === 0 ? (
        <div className="relative mt-6 overflow-hidden rounded-xl border border-dashed border-border bg-card p-8 sm:p-10">
          <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-25" />
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:text-left">
            <div className="grid size-28 shrink-0 place-items-center rounded-lg border border-border bg-brand-panel">
              <BlueprintGlyph size={96} className="opacity-80" />
            </div>
            <div className="max-w-md text-center sm:text-left">
              <p className="mono-label text-brand-pink">NO SETS FOUND</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                Compile your first set.
              </h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                Upload photos, sample a video or paste notes. Bluprint will build a summary,
                ten flashcards, a five-question quiz and three exam questions.
              </p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="mt-5 h-9 rounded-md bg-brand-pink px-4 font-mono text-[10.5px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
              >
                <Plus className="size-3.5" />
                NEW SET
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((set) => (
            <SetCard key={set._id} set={set} />
          ))}
        </div>
      )}

      <CreateSetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
