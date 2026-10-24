import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
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
  ChevronRight,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Menu,
  Plus,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

const deckColors = [
  "#7C5CFF",
  "#12B8A6",
  "#F472B6",
  "#FB923C",
  "#3B82F6",
  "#4ADE80",
  "#FBBF24",
  "#A78BFA",
  "#EF5F6B",
];

const navItems = [
  {
    to: "/dashboard",
    label: "Home",
    icon: Home,
    tint: "bg-[#E9F0FF] text-[#3B82F6]",
  },
  {
    to: "/dashboard#courses",
    label: "My courses",
    icon: GraduationCap,
    tint: "bg-[#E6F9F6] text-[#0E8C7F]",
  },
  {
    to: "/dashboard#sets",
    label: "My sets",
    icon: Layers,
    tint: "bg-[#F3ECFF] text-[#7C5CFF]",
  },
  {
    to: "/dashboard?new=1",
    label: "New set",
    icon: Sparkles,
    tint: "bg-[#FFE9F2] text-[#EC4899]",
  },
] as const;

function DeckRow({
  to,
  title,
  color,
  active,
  onNavigate,
}: {
  to: string;
  title: string;
  color: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-xl py-1.5 pl-2 pr-1 transition-colors",
        active ? "bg-brand-panel" : "hover:bg-brand-panel/70",
      )}
    >
      <ChevronRight className="size-3.5 shrink-0 text-brand-ink/35" />
      <span
        className="size-3 shrink-0 rounded-[3px]"
        style={{ backgroundColor: color }}
      />
      <span
        className={cn(
          "truncate text-[0.94rem] leading-6",
          active ? "font-semibold text-brand-ink" : "text-brand-ink/80",
        )}
      >
        {title}
      </span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sets = useQuery(api.studySets.listMine);
  const ai = useQuery(api.settings.aiStatus);

  const decks = useMemo(
    () =>
      [...(sets ?? [])].sort(
        (a, b) => (b.lastStudiedAt ?? b.updatedAt) - (a.lastStudiedAt ?? a.updatedAt),
      ),
    [sets],
  );
  const studyTarget = decks.find((deck) => deck.status === "ready") ?? decks[0];

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
      <div className="px-5 pt-6 pb-5">
        <Brand onNavigate={onNavigate} />
      </div>

      <nav className="flex flex-col gap-0.5 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.to === "/dashboard"
              ? location.pathname === "/dashboard" && !location.hash
              : item.to === "/dashboard#courses"
                ? location.pathname.startsWith("/courses")
                : item.to === "/dashboard#sets"
                  ? location.pathname.startsWith("/sets/")
                  : false;
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={cn("gizmo-row", active && "gizmo-row-active")}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-[0.6rem]",
                  item.tint,
                )}
              >
                <Icon className="size-4" strokeWidth={2.2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 flex flex-col gap-2 px-4">
        <Button
          asChild
          className="h-11 w-full rounded-full bg-[#191B27] text-[0.95rem] font-semibold text-white hover:bg-[#2A2D3E]"
        >
          <Link
            to={studyTarget ? `/sets/${studyTarget._id}` : "/dashboard?new=1"}
            onClick={onNavigate}
          >
            <Sparkles className="size-4" />
            Study
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-11 w-full rounded-full border-border bg-white text-[0.95rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
        >
          <Link to="/dashboard?new=1" onClick={onNavigate}>
            <Plus className="size-4" />
            Add
          </Link>
        </Button>
      </div>

      <div className="mt-5 flex items-center justify-between px-5 pb-2">
        <p className="text-[0.95rem] font-semibold text-brand-ink">My decks</p>
        <Link
          to="/dashboard?new=1"
          onClick={onNavigate}
          aria-label="Add a deck"
          className="grid size-7 place-items-center rounded-lg text-brand-ink/60 transition-colors hover:bg-brand-panel hover:text-brand-ink"
        >
          <Plus className="size-4" />
        </Link>
      </div>

      <div className="gizmo-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {decks.length === 0 ? (
          <p className="px-2 py-3 text-[0.82rem] leading-relaxed text-muted-foreground">
            Nothing here yet. Add notes to build your first deck.
          </p>
        ) : (
          decks.map((deck, index) => (
            <DeckRow
              key={deck._id}
              to={`/sets/${deck._id}`}
              title={deck.title}
              color={deckColors[index % deckColors.length]}
              active={location.pathname === `/sets/${deck._id}`}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>

      <div className="border-t border-sidebar-border px-4 py-4">
        {ai && !ai.configured && (
          <p className="mb-3 rounded-xl bg-[#FFF6E5] px-3 py-2 text-[0.72rem] leading-relaxed font-medium text-[#9A6400]">
            NVIDIA_API_KEY is not set on this deployment.
          </p>
        )}
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            title="Sign out"
            className="rounded-full text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
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
        <div className="flex items-center gap-1">
          <Button
            asChild
            size="icon"
            aria-label="Add a set"
            className="size-9 rounded-full bg-[#191B27] text-white hover:bg-[#2A2D3E]"
          >
            <Link to="/dashboard?new=1">
              <Plus className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="size-9 rounded-full text-brand-ink/70 hover:bg-brand-panel"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
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
