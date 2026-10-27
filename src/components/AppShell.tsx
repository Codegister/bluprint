import { Brand } from "@/components/Brand";
import { ChromeBackdrop } from "@/components/ChromeBackdrop";
import { PageInk } from "@/components/InkInWater";
import { ThemeToggle } from "@/components/ThemeToggle";
import { enter } from "@/components/motion/Motion";
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
import { subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useScroll } from "framer-motion";
import {
  CalendarDays,
  GraduationCap,
  Menu,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * The sidebar is a page of the same notebook as the rest of the app. Each
 * destination owns a colour: the icon is tinted in its hue, the active row
 * gets a wash of it, and the marker bar uses it, so the rail reads as four
 * coloured places rather than four grey ones. `tile` is the active icon chip;
 * `soft` is the quiet version used when the row is not active.
 */
const navItems = [
  {
    // Home is the tutor: ask a question, continue a set, open the library.
    to: "/tutor",
    label: "Home",
    icon: Sparkles,
    accent: "bg-brand-sky",
    active: "bg-brand-sky/15 text-brand-ink ring-1 ring-brand-sky/25",
    tile: "bg-brand-sky/20 text-brand-sky",
    soft: "bg-brand-sky/10 text-brand-sky",
  },
  {
    to: "/courses",
    label: "Courses",
    icon: GraduationCap,
    accent: "bg-brand-violet",
    active: "bg-brand-violet/15 text-brand-ink ring-1 ring-brand-violet/25",
    tile: "bg-brand-violet/20 text-brand-violet",
    soft: "bg-brand-violet/10 text-brand-violet",
  },
  {
    to: "/today",
    label: "Today",
    icon: Target,
    accent: "bg-brand-mint",
    active: "bg-brand-mint/15 text-brand-ink ring-1 ring-brand-mint/25",
    tile: "bg-brand-mint/20 text-brand-mint",
    soft: "bg-brand-mint/10 text-brand-mint",
  },
  {
    to: "/timetable",
    label: "Timetable",
    icon: CalendarDays,
    accent: "bg-brand-peach",
    active: "bg-brand-peach/15 text-brand-ink ring-1 ring-brand-peach/25",
    tile: "bg-brand-peach/20 text-brand-peach",
    soft: "bg-brand-peach/10 text-brand-peach",
  },
] as const;

function DeckRow({
  to,
  title,
  due,
  accent,
  active,
  onNavigate,
}: {
  to: string;
  title: string;
  due: number;
  /** The set's subject colour, so the deck list has the same language. */
  accent: string;
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
          ? "bg-brand-sky/15 font-semibold text-brand-ink ring-1 ring-brand-sky/25"
          : "text-brand-ink hover:bg-white/80",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="truncate">{title}</span>
      </span>
      {due > 0 && (
        <span className="shrink-0 rounded-full bg-brand-peach/20 px-2 py-0.5 text-[0.65rem] font-semibold text-brand-peach">
          {due} due
        </span>
      )}
    </Link>
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
    <div className="chrome-rail relative flex h-full flex-col overflow-hidden">

      <div className="relative px-5 pb-5 pt-6">
        <Brand onNavigate={onNavigate} />
      </div>

      <nav className="relative flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          // Everything reached from the tutor home — a saved set, a scoped
          // conversation — keeps the Home tab lit, because that is the
          // screen the student started from.
          const active =
            item.to === "/tutor"
              ? location.pathname.startsWith("/tutor") ||
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
                  : "text-brand-ink hover:bg-white/80",
              )}
            >
              {/* A plain marker, not a shared layout animation: the sidebar is
                  re-rendered by every page, and a projection-driven bar drifted
                  whenever the page underneath changed height (for example while
                  picking an exam board). */}
              {active && (
                <span
                  aria-hidden
                  className={cn(
                    "nav-active-bar absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full",
                    item.accent,
                  )}
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

      <div className="relative mt-5 flex items-center justify-between px-4 pb-2">
        <p className="px-1 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Your sets
        </p>
        <Link
          to="/tutor#sets"
          onClick={onNavigate}
          className="text-[0.72rem] font-semibold text-muted-foreground underline-offset-2 hover:text-brand-ink hover:underline"
        >
          All sets
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
          decks.slice(0, 4).map((deck) => (
            <DeckRow
              key={deck._id}
              to={`/sets/${deck._id}`}
              title={deck.title}
              due={deck.dueCount}
              accent={subjectMeta(deck.course ?? "").color}
              active={location.pathname.startsWith(`/sets/${deck._id}`)}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>

      <div className="relative border-t border-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-brand-violet/30 bg-brand-violet/15 text-[0.85rem] font-bold text-brand-violet">
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
          {/* A preference, not a destination: it belongs with the account. */}
          <ThemeToggle />
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
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen">
      {/* The paper wash, then the ink that moves through it, behind every
          signed-in screen. */}
      <ChromeBackdrop intensity={0.55} />
      <PageInk intensity={1.15} />
      <motion.div
        aria-hidden
        className="chrome-progress fixed inset-x-0 top-0 z-40 h-[2px] origin-left"
        style={{ scaleX: scrollYProgress }}
      />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[292px] border-r border-border lg:block">
        <Sidebar />
      </aside>

      <header className="chrome-bar sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <Brand to="/tutor" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-full bg-white text-brand-ink ring-1 ring-border transition-colors hover:bg-brand-panel"
          >
            <Menu className="size-5 text-brand-sky" />
          </button>
        </div>
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
        {/* Every destination enters the same way, so moving between screens
            reads as one surface changing rather than a new page loading. The
            key is the path, so set tabs animate too. */}
        <motion.div
          key={pathname}
          className="relative mx-auto w-full max-w-[1080px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10"
          {...enter(0.02, 8)}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
