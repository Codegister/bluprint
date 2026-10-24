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
import { Menu } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

/** Each destination keeps its own colour, so the sidebar reads as a map. */
const navItems = [
  {
    to: "/dashboard",
    label: "Home",
    active: "bg-[#F3F0FF] text-[#5130D8]",
    dot: "bg-[#7C5CFF]",
  },
  {
    to: "/dashboard#courses",
    label: "My courses",
    active: "bg-[#EAFBF4] text-[#0C6B4C]",
    dot: "bg-[#128A4C]",
  },
  {
    to: "/dashboard#sets",
    label: "My sets",
    active: "bg-[#FFF4E8] text-[#96560C]",
    dot: "bg-[#F0A03C]",
  },
  {
    to: "/timetable",
    label: "Revision timetable",
    active: "bg-[#EAF4FD] text-[#1B5C8A]",
    dot: "bg-[#2B7FB8]",
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
          ? "bg-brand-panel font-semibold text-brand-ink"
          : "text-brand-ink/75 hover:bg-brand-panel/70",
      )}
    >
      <span className="truncate">{title}</span>
      {due > 0 && (
        <span className="shrink-0 rounded-full bg-[#FFF3E8] px-2 py-0.5 text-[0.65rem] font-semibold text-[#C2660F]">
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
    <div className="flex h-full flex-col bg-sidebar">
      <div className="relative overflow-hidden px-5 pb-5 pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-20 h-40 bg-[radial-gradient(circle_at_35%_65%,rgba(124,92,255,0.20),transparent_70%)]"
        />
        <Brand onNavigate={onNavigate} />
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {navItems.map((item) => {
          const active =
            item.to === "/dashboard"
              ? location.pathname === "/dashboard" && !location.hash
              : item.to === "/dashboard#courses"
                ? location.pathname.startsWith("/courses")
                : item.to === "/dashboard#sets"
                  ? location.pathname.startsWith("/sets/")
                  : location.pathname.startsWith("/timetable");
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-[0.95rem] font-medium transition-colors",
                active
                  ? `font-semibold ${item.active}`
                  : "text-brand-ink/75 hover:bg-brand-panel hover:text-brand-ink",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  active ? item.dot : "bg-brand-ink/20",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 px-4 pb-2">
        <p className="px-3 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Your sets
        </p>
      </div>

      <div className="gizmo-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
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

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#EFEDFF] text-[0.85rem] font-bold text-[#5B3DF5]">
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
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[292px] border-r border-sidebar-border bg-sidebar lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand to="/dashboard" />
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="grid size-9 place-items-center rounded-full text-brand-ink/70 hover:bg-brand-panel"
        >
          <Menu className="size-5" />
        </button>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] border-r-border bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Bluprint menu</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="lg:pl-[292px]">
        <div className="mx-auto w-full max-w-[1080px] px-4 py-7 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
