import { Brand } from "@/components/Brand";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { readableError } from "@/lib/errors";
import { displayName, initialFor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  CalendarDays,
  Flame,
  GraduationCap,
  Home,
  Layers3,
  Menu,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * Each destination keeps its own colour, so the sidebar reads as a map rather
 * than a list. `tile` is the icon chip when the row is active; `soft` is the
 * same chip when it is not.
 */
const navItems = [
  {
    to: "/dashboard",
    label: "Home",
    icon: Home,
    active: "bg-[#F1ECFF] text-[#4B2BD6]",
    tile: "bg-[#7C5CFF] text-white",
    soft: "bg-[#EDE8FF] text-[#6B4BFF]",
  },
  {
    to: "/dashboard#tutor",
    label: "AI tutor",
    icon: Sparkles,
    active: "bg-[#FDEFF4] text-[#A83458]",
    tile: "bg-[#D9577E] text-white",
    soft: "bg-[#FFE7F0] text-[#C43F69]",
  },
  {
    to: "/dashboard#courses",
    label: "My courses",
    icon: GraduationCap,
    active: "bg-[#E6F9F1] text-[#0C6B4C]",
    tile: "bg-[#128A4C] text-white",
    soft: "bg-[#E6F7EF] text-[#128A4C]",
  },
  {
    to: "/dashboard#sets",
    label: "My sets",
    icon: Layers3,
    active: "bg-[#FFF3E3] text-[#96560C]",
    tile: "bg-[#F0A03C] text-white",
    soft: "bg-[#FFF1DE] text-[#B4720E]",
  },
  {
    to: "/timetable",
    label: "Revision timetable",
    icon: CalendarDays,
    active: "bg-[#E8F3FD] text-[#1B5C8A]",
    tile: "bg-[#2B7FB8] text-white",
    soft: "bg-[#E7F2FC] text-[#2B7FB8]",
  },
] as const;

function DeckRow({
  to,
  title,
  due,
  active,
  onNavigate,
}: {
  to: string;
  title: string;
  due: number;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[0.92rem] transition-colors",
        active
          ? "bg-white font-semibold text-brand-ink shadow-[0_6px_16px_-14px_rgba(60,40,120,0.7)]"
          : "text-brand-ink/75 hover:bg-white/70",
      )}
    >
      <span className="truncate">{title}</span>
      {due > 0 && (
        <span className="shrink-0 rounded-full bg-[#FFF0DC] px-2 py-0.5 text-[0.65rem] font-semibold text-[#B4720E]">
          {due} due
        </span>
      )}
    </Link>
  );
}

/** Today's review goal, shown as a small progress card above the set list. */
function GoalCard() {
  const study = useQuery(api.studySets.studyStats);
  const today = study?.todayCount ?? 0;
  const goal = study?.goal ?? 1;
  const streak = study?.streak ?? 0;
  const progress = Math.min(100, Math.round((today / Math.max(goal, 1)) * 100));

  return (
    <div className="mx-3 mb-4 rounded-2xl border border-white/80 bg-white/70 p-3 shadow-[0_14px_28px_-26px_rgba(60,40,120,0.6)] backdrop-blur">
      <div className="flex items-baseline justify-between gap-2">
        <p className="mono-label text-[#5B3DF5]">Today</p>
        <p className="text-[0.7rem] font-semibold tabular-nums text-brand-ink/55">
          {study ? `${today}/${goal} cards` : "—"}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ECE6FF]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#6B4BFF,#EC4899)] transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[0.72rem] leading-snug text-brand-ink/60">
        {streak > 0 ? (
          <>
            <Flame className="size-3.5 text-[#F0871F]" aria-hidden />
            <span className="font-semibold text-brand-ink/80">
              {streak} day{streak === 1 ? "" : "s"}
            </span>
            on the bounce
          </>
        ) : (
          (study ? "Review a card to start a streak" : "Every card counts")
        )}
      </p>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sets = useQuery(api.studySets.listMine);

  const decks = useMemo(
    () =>
      [...(sets ?? [])].sort(
        (a, b) => (b.lastStudiedAt ?? b.updatedAt) - (a.lastStudiedAt ?? a.updatedAt),
      ),
    [sets],
  );

  const handleSignOut = async () => {
    try {
      await signOut();
      onNavigate?.();
      navigate("/");
    } catch (error) {
      toast.error(readableError(error, "Could not sign out. Please try again."));
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#F6F1FF_0%,#FCF9F3_36%,#FBFAF7_100%)]">
      {/* Colour spots sitting behind the nav give the panel depth without
          tinting any text. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="blob -left-16 -top-24 size-56 bg-[#C4B5FD]/55 blob-float" />
        <div className="blob -right-20 top-40 size-48 bg-[#FFD7E6]/50" />
        <div className="blob -left-10 bottom-24 size-44 bg-[#B9F0E4]/40" />
      </div>

      <div className="relative px-5 pb-5 pt-6">
        <Brand onNavigate={onNavigate} />
      </div>

      <nav className="relative flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const active =
            item.to === "/dashboard"
              ? location.pathname === "/dashboard" && !location.hash
              : item.to === "/dashboard#tutor"
                ? location.pathname === "/dashboard" && location.hash === "#tutor"
                : item.to === "/dashboard#courses"
                  ? location.pathname.startsWith("/courses")
                  : item.to === "/dashboard#sets"
                    ? location.pathname.startsWith("/sets/")
                    : location.pathname.startsWith("/timetable");
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-[0.95rem] font-medium transition-colors",
                active
                  ? `font-semibold ${item.active}`
                  : "text-brand-ink/75 hover:bg-white/70 hover:text-brand-ink",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-[0.6rem] transition-colors",
                  active ? item.tile : item.soft,
                )}
              >
                <Icon className="size-[15px]" aria-hidden />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-5">
        <GoalCard />
      </div>

      <div className="relative flex items-center justify-between px-4 pb-2">
        <p className="px-1 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Your sets
        </p>
        <Link
          to="/dashboard?new=1"
          onClick={onNavigate}
          aria-label="New study set"
          className="grid size-6 place-items-center rounded-full bg-white/80 text-[0.9rem] font-semibold text-[#5B3DF5] shadow-[0_4px_12px_-10px_rgba(60,40,120,0.8)] transition-colors hover:bg-white"
        >
          +
        </Link>
      </div>

      <div className="gizmo-scroll relative min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {decks.length === 0 ? (
          <p className="px-3 py-3 text-[0.82rem] leading-relaxed text-muted-foreground">
            Nothing here yet. Add your notes or open a course topic to build your
            first set.
          </p>
        ) : (
          decks.map((deck) => (
            <DeckRow
              key={deck._id}
              to={`/sets/${deck._id}`}
              title={deck.title}
              due={deck.dueCount}
              active={location.pathname === `/sets/${deck._id}`}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>

      <div className="relative border-t border-white/70 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#8B5CF6,#EC4899)] text-[0.85rem] font-bold text-white shadow-[0_8px_18px_-12px_rgba(109,40,217,0.9)]">
            {initialFor(user?.name, user?.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.85rem] font-semibold text-brand-ink">
              {displayName(user?.name, user?.email)}
            </p>
            <p className="truncate text-[0.72rem] text-muted-foreground">
              {user?.email ?? "Private account"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 text-[0.76rem] font-semibold text-muted-foreground underline-offset-2 hover:text-brand-ink hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Shared layout for every signed-in screen. */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[292px] border-r border-[#E9E2F5] lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/70 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <Brand to="/dashboard" />
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="grid size-9 place-items-center rounded-full bg-white text-brand-ink/70 ring-1 ring-border transition-colors hover:text-brand-ink"
        >
          <Menu className="size-5" />
        </button>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] border-r-border p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Bluprint menu</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="relative lg:pl-[292px]">
        {/* Soft colour behind page content. Fixed to the top of the canvas so
            long pages do not scroll a hard gradient edge through the copy. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden"
        >
          <div className="blob right-[-120px] top-[-140px] size-[360px] bg-[#D8CCFF]/60 blob-float" />
          <div className="blob left-[18%] top-[220px] size-[240px] bg-[#FFD7E6]/45" />
        </div>

        <div className="relative mx-auto w-full max-w-[1080px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
