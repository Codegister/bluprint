import { Brand } from "@/components/Brand";
import { ChromeBackdrop } from "@/components/ChromeBackdrop";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Meter, SPRING } from "@/components/motion/Motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { readableError } from "@/lib/errors";
import { displayName, initialFor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useScroll } from "framer-motion";
import {
  CalendarDays,
  Flame,
  GraduationCap,
  Layers3,
  Menu,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * The sidebar is a page of the same notebook as the rest of the app. Each
 * destination gets one of the pastel highlighters when it is active, while
 * the icon tile stays ink so the rail keeps a single strong vertical rhythm.
 * `tile` is the icon chip; `soft` is the quiet version used when the row is
 * not active.
 */
const navItems = [
  {
    to: "/dashboard",
    label: "My sets",
    icon: Layers3,
    active: "bg-gizmo-lime text-[#1C1A14]",
    tile: "bg-[#1C1A14] text-gizmo-lime",
    soft: "bg-gizmo-lime/45 text-[#1C1A14] dark:bg-gizmo-lime/20 dark:text-brand-ink",
  },
  {
    to: "/courses",
    label: "My courses",
    icon: GraduationCap,
    active: "bg-gizmo-lilac/65 text-[#1C1A14]",
    tile: "bg-[#1C1A14] text-gizmo-lilac",
    soft: "bg-gizmo-lilac/40 text-[#1C1A14] dark:bg-gizmo-lilac/20 dark:text-brand-ink",
  },
  {
    to: "/tutor",
    label: "AI tutor",
    icon: Sparkles,
    active: "bg-gizmo-sky/65 text-[#1C1A14]",
    tile: "bg-[#1C1A14] text-gizmo-sky",
    soft: "bg-gizmo-sky/40 text-[#1C1A14] dark:bg-gizmo-sky/20 dark:text-brand-ink",
  },
  {
    to: "/timetable",
    label: "Revision timetable",
    icon: CalendarDays,
    active: "bg-gizmo-peach/70 text-[#1C1A14]",
    tile: "bg-[#1C1A14] text-gizmo-peach",
    soft: "bg-gizmo-peach/40 text-[#1C1A14] dark:bg-gizmo-peach/20 dark:text-brand-ink",
  },
  {
    to: "/today",
    label: "Today",
    icon: Target,
    active: "bg-gizmo-mint/75 text-[#1C1A14]",
    tile: "bg-[#1C1A14] text-gizmo-mint",
    soft: "bg-gizmo-mint/40 text-[#1C1A14] dark:bg-gizmo-mint/20 dark:text-brand-ink",
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
          ? "bg-gizmo-lime/45 font-semibold text-brand-ink dark:bg-gizmo-lime/20"
          : "text-brand-ink/75 hover:bg-white/70",
      )}
    >
      <span className="truncate">{title}</span>
      {due > 0 && (
        <span className="shrink-0 rounded-full bg-brand-ink px-2 py-0.5 text-[0.65rem] font-semibold text-brand-cream">
          {due} due
        </span>
      )}
    </Link>
  );
}

/** Today's question goal, shown as a small progress card above the set list. */
function GoalCard() {
  const study = useQuery(api.studySets.studyStats);
  const today = study?.todayCount ?? 0;
  const goal = study?.goal ?? 20;
  const streak = study?.streak ?? 0;
  const progress = Math.min(100, Math.round((today / Math.max(goal, 1)) * 100));

  return (
    <Link
      to="/today"
      className="mx-3 mb-4 block rounded-2xl border border-border bg-white/80 p-3 shadow-[0_2px_0_rgba(28,26,20,0.05)] transition-colors hover:bg-white"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="mono-label text-chrome-7">Today</p>
        <p className="text-[0.7rem] font-semibold tabular-nums text-brand-ink/55">
          {study ? `${today}/${goal} questions` : "—"}
        </p>
      </div>
      <Meter
        value={progress}
        className="mt-2 h-1.5 bg-brand-ink/10"
        barClassName="bg-brand-pink-deep"
        label="Questions answered today"
      />
      <p className="mt-2 flex items-center gap-1.5 text-[0.72rem] leading-snug text-brand-ink/60">
        {streak > 0 ? (
          <>
            <Flame className="size-3.5 text-brand-pink-deep" aria-hidden />
            <span className="font-semibold text-brand-ink/80">
              {streak} day{streak === 1 ? "" : "s"}
            </span>
            {study?.tier ? `· ${study.tier} tier` : "on the bounce"}
          </>
        ) : (
          (study ? "Reach 10 questions to start a streak" : "Every question counts")
        )}
      </p>
    </Link>
  );
}

function Sidebar({
  onNavigate,
  idPrefix,
}: {
  onNavigate?: () => void;
  /** Desktop and mobile mount two copies; the layout animation needs a
   *  unique id per copy or the pill would fly between them. */
  idPrefix: string;
}) {
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
    <div className="chrome-rail relative flex h-full flex-col overflow-hidden">

      <div className="relative px-5 pb-5 pt-6">
        <Brand onNavigate={onNavigate} />
      </div>

      <nav className="relative flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const active =
            item.to === "/dashboard"
              ? location.pathname === "/dashboard" ||
                location.pathname.startsWith("/sets/")
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-[0.95rem] font-medium transition-colors",
                active
                  ? `font-semibold ${item.active}`
                  : "text-brand-ink/75 hover:bg-white/70 hover:text-brand-ink",
              )}
            >
              {/* One shared bar slides between destinations, so the nav reads
                  as a single moving object rather than five separate states. */}
              {active && (
                <motion.span
                  layoutId={`${idPrefix}-nav-active`}
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] rounded-full bg-current"
                  style={{ marginTop: -10 }}
                  transition={SPRING}
                />
              )}
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
          className="grid size-6 place-items-center rounded-full border border-brand-ink/40 bg-gizmo-lime text-[0.9rem] font-bold text-brand-ink shadow-[0_2px_0_rgba(28,26,20,0.18)] transition-transform hover:-rotate-6"
        >
          +
        </Link>
      </div>

      <div className="gizmo-scroll relative min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {sets === undefined ? (
          <div role="status" aria-busy="true" className="space-y-2 px-2 py-2">
            <span className="sr-only">Loading your study sets</span>
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-8 rounded-xl" aria-hidden="true" />
            ))}
          </div>
        ) : decks.length === 0 ? (
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
              active={location.pathname.startsWith(`/sets/${deck._id}`)}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>

      <div className="relative border-t border-white/70 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-brand-ink/50 bg-gizmo-lime text-[0.85rem] font-bold text-brand-ink">
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
          <ThemeToggle className="-mr-1.5" />
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
  // A single accent rule that fills as the page scrolls. It replaces the
  // decorative colour wash as the thing that makes a long screen feel alive.
  const { scrollYProgress } = useScroll();

  return (
    <div className="min-h-screen">
      {/* The paper wash behind every signed-in screen. */}
      <ChromeBackdrop intensity={0.55} />
      <motion.div
        aria-hidden
        className="chrome-progress fixed inset-x-0 top-0 z-40 h-[2px] origin-left"
        style={{ scaleX: scrollYProgress }}
      />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[292px] border-r border-border lg:block">
        <Sidebar idPrefix="desktop" />
      </aside>

      <header className="chrome-bar sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <Brand to="/dashboard" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-full bg-white text-brand-ink/70 ring-1 ring-border transition-colors hover:text-brand-ink"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] border-r-border p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Bluprint menu</SheetTitle>
          </SheetHeader>
          <Sidebar idPrefix="mobile" onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="relative lg:pl-[292px]">
        <div className="relative mx-auto w-full max-w-[1080px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
