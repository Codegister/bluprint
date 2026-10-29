import { Brand } from "@/components/Brand";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ChromeBackdrop } from "@/components/ChromeBackdrop";
import { PageInk } from "@/components/InkInWater";
import { ThemeToggle } from "@/components/ThemeToggle";
import { enter } from "@/components/motion/Motion";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { AccountExportButton } from "@/components/study/ShareAndExport";
import { useAuth } from "@/hooks/use-auth";
import { notifyError } from "@/lib/errors";
import { displayName, initialFor } from "@/lib/format";
import { subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion, useScroll } from "framer-motion";
import {
  CalendarDays,
  FileText,
  GraduationCap,
  Loader2,
  Menu,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * The sidebar is a page of the same notebook as the rest of the app. The icon
 * of each destination keeps its own hue, which is what makes the rail scannable
 * at a glance. The *selected* row is drawn in the app's single action accent,
 * so there is one colour that means "you are here" rather than four: the peach
 * highlight the Timetable row used to carry read as a different state from the
 * other three. `tile` is the active icon chip; `soft` is the quiet version used
 * when the row is not active.
 */
const ACTIVE_ROW = "bg-brand-sky/15 text-brand-ink ring-1 ring-brand-sky/25";

const navItems = [
  {
    // Home is the tutor: ask a question, continue a set, open the library.
    to: "/tutor",
    label: "Home",
    icon: Sparkles,
    active: ACTIVE_ROW,
    tile: "bg-brand-sky/20 text-brand-sky",
    soft: "bg-brand-sky/10 text-brand-sky",
  },
  {
    to: "/courses",
    label: "Courses",
    icon: GraduationCap,
    active: ACTIVE_ROW,
    tile: "bg-brand-violet/20 text-brand-violet",
    soft: "bg-brand-violet/10 text-brand-violet",
  },
  {
    // Real past-paper questions, marked against the board's own scheme.
    to: "/past-papers",
    label: "Past papers",
    icon: FileText,
    active: ACTIVE_ROW,
    tile: "bg-brand-peach/25 text-brand-peach",
    soft: "bg-brand-peach/15 text-brand-peach",
  },
  {
    to: "/today",
    label: "Today",
    icon: Target,
    active: ACTIVE_ROW,
    tile: "bg-brand-mint/20 text-brand-mint",
    soft: "bg-brand-mint/10 text-brand-mint",
  },
  {
    to: "/timetable",
    label: "Timetable",
    icon: CalendarDays,
    active: ACTIVE_ROW,
    tile: "bg-brand-teal/20 text-brand-teal",
    soft: "bg-brand-teal/10 text-brand-teal",
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
        // The same amber every other "due" count uses, so a due badge looks the
        // same in the rail as it does on Today and in the library.
        <span className="shrink-0 rounded-full bg-[#f4e3bd] px-2 py-0.5 text-[0.65rem] font-semibold text-[#5b3d00]">
          {due} due
        </span>
      )}
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const deleteAccount = useMutation(api.users.deleteAccount);
  const sets = useQuery(api.studySets.listMine);
  // A guest has no email to sign back in with, so leaving the session deletes
  // the only copy of their work. Ask before doing that.
  const [confirmingGuestSignOut, setConfirmingGuestSignOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const decks = useMemo(
    () =>
      [...(sets ?? [])].sort(
        (a, b) => (b.lastStudiedAt ?? b.updatedAt) - (a.lastStudiedAt ?? a.updatedAt),
      ),
    [sets],
  );

  const performSignOut = async () => {
    try {
      await signOut();
      onNavigate?.();
      // A full navigation, not a router push: signing out while on a protected
      // route otherwise races RequireAuth, which sends the now-guest to
      // /auth?returnTo=/tutor. This always lands on the marketing homepage.
      window.location.replace(import.meta.env.BASE_URL || "/");
    } catch (error) {
      notifyError(error, "Could not sign out. Please try again.");
    }
  };

  const handleSignOut = async () => {
    if (user?.isAnonymous) {
      setConfirmingGuestSignOut(true);
      return;
    }
    await performSignOut();
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success("Your account and every set attached to it were deleted.");
      try {
        await signOut();
      } catch {
        // The user row and sessions are already gone; signing out locally is
        // best-effort from here.
      }
      window.location.replace(import.meta.env.BASE_URL || "/");
    } catch (error) {
      notifyError(error, "Could not delete your account. Please try again.");
      setDeleting(false);
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
                  className="nav-active-bar absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand-sky"
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
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-[0.76rem] font-semibold text-muted-foreground underline-offset-2 hover:text-brand-ink hover:underline"
          >
            Sign out
          </button>
          {user && !user.isAnonymous && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-[0.76rem] font-semibold text-[#A81F28] underline-offset-2 hover:underline"
            >
              Delete account
            </button>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmingGuestSignOut}
        onOpenChange={setConfirmingGuestSignOut}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Sign out of this guest workspace?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Your sets, cards and progress live only in this browser. There is
              no email account to sign back into, so signing out removes this
              session and the work attached to it. Use the set&apos;s export
              buttons first if you want to keep a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setConfirmingGuestSignOut(false);
                onNavigate?.();
                navigate(
                  `/auth?link=1&returnTo=${encodeURIComponent(location.pathname)}`,
                );
              }}
              className="inline-flex h-10 items-center justify-center rounded-full bg-brand-sky px-4 text-[0.82rem] font-semibold text-white hover:bg-brand-sky/90"
            >
              Add an email to keep them
            </button>
            <AlertDialogCancel className="rounded-full">
              Keep my sets
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void performSignOut()}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              Sign out anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete your account?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-muted-foreground">
              <span className="block">
                This removes every study set, card, note, uploaded image, mark
                and your account row. It cannot be undone.
              </span>
              <span className="block font-medium text-brand-ink">
                Download a copy first if you might want your notes later.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <AccountExportButton />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleting}>
              Keep my account
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void performDelete();
              }}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 size-4" aria-hidden />
                  Delete everything
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A standing reminder for guests once they have work worth losing. */
function GuestNotice() {
  const { user } = useAuth();
  const sets = useQuery(api.studySets.listMine);
  if (!user?.isAnonymous || !sets || sets.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-[#E8D3A3] bg-[#FFF8E8] px-4 py-3 text-[0.8rem] leading-relaxed text-[#7A5200]">
      <span className="font-semibold">Guest workspace.</span> Your sets live
      only in this browser. Signing out or clearing site data removes them.{" "}
      <Link
        to="/auth?link=1&returnTo=%2Ftutor"
        className="font-semibold underline decoration-[#7A5200]/40 underline-offset-2 hover:text-brand-ink"
      >
        Add an email to keep them
      </Link>
      , or export anything you want to keep first.
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

      {/* One mount for the offline copy and its queue, on every screen. */}
      <OfflineBanner />

      <main className="relative lg:pl-[292px]">
        {/* Every destination enters the same way, so moving between screens
            reads as one surface changing rather than a new page loading. The
            key is the path, so set tabs animate too. */}
        <motion.div
          key={pathname}
          className="relative mx-auto w-full max-w-[1080px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10"
          {...enter(0.02, 8)}
        >
          <GuestNotice />
          {children}
        </motion.div>
      </main>
    </div>
  );
}
