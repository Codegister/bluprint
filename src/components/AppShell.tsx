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
  ArrowUpRight,
  KeyRound,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

function NavItem({
  to,
  active,
  icon,
  children,
  onClick,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-brand-ink text-brand-cream"
          : "text-brand-ink/65 hover:bg-brand-ink/[0.06] hover:text-brand-ink",
      )}
    >
      <span className={cn("[&_svg]:size-[18px]", active && "text-brand-pink")}>
        {icon}
      </span>
      {children}
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ai = useQuery(api.settings.aiStatus);
  const setsActive =
    location.pathname === "/dashboard" || location.pathname.startsWith("/sets/");

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
    <div className="flex h-full flex-col gap-6 p-5">
      <Brand onNavigate={onNavigate} />

      <Button
        asChild
        className="h-10 w-full rounded-xl border-2 border-brand-ink bg-brand-pink font-semibold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream"
      >
        <Link to="/dashboard?new=1" onClick={onNavigate}>
          <Plus className="size-4" />
          New study set
        </Link>
      </Button>

      <nav className="flex flex-col gap-1.5">
        <p className="px-3.5 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink/40">
          Study
        </p>
        <NavItem
          to="/dashboard"
          active={setsActive}
          icon={<LayoutGrid />}
          onClick={onNavigate}
        >
          My study sets
        </NavItem>
        <NavItem
          to="/setup"
          active={location.pathname === "/setup"}
          icon={<KeyRound />}
          onClick={onNavigate}
        >
          AI setup
        </NavItem>
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <Link
          to="/setup"
          onClick={onNavigate}
          className={cn(
            "group rounded-2xl border p-3.5 transition-colors",
            ai?.configured
              ? "border-brand-mint bg-brand-mint/50 hover:bg-brand-mint/70"
              : "border-brand-lime bg-brand-lime/50 hover:bg-brand-lime/70",
          )}
        >
          <div className="flex items-start gap-2.5">
            {ai === undefined ? (
              <Loader2 className="mt-0.5 size-4 animate-spin text-brand-ink/50" />
            ) : (
              <Sparkles className="mt-0.5 size-4 text-brand-ink" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-tight text-brand-ink">
                {ai === undefined
                  ? "Checking NVIDIA…"
                  : ai.configured
                    ? "Pip is ready"
                    : "Add your NVIDIA key"}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-brand-ink/60">
                {ai?.configured
                  ? "NVIDIA_API_KEY is connected"
                  : "Two-minute setup to start generating"}
              </p>
            </div>
            <ArrowUpRight className="size-3.5 shrink-0 text-brand-ink/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
        </Link>

        <div className="flex items-center gap-2.5 border-t border-brand-ink/10 pt-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-brand-ink/15 bg-brand-pink/50 font-display text-sm font-bold text-brand-ink">
            {initialFor(user?.name, user?.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-brand-ink">
              {displayName(user?.name, user?.email)}
            </p>
            <p className="truncate text-[11px] text-brand-ink/45">
              {user?.email ?? "Private account"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            title="Sign out"
            className="rounded-xl text-brand-ink/50 hover:bg-brand-ink/5 hover:text-brand-ink"
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] border-r border-brand-ink/10 bg-sidebar lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-ink/10 bg-brand-cream/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <Button
            asChild
            size="icon"
            aria-label="New study set"
            className="size-9 rounded-xl border-2 border-brand-ink bg-brand-pink text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream"
          >
            <Link to="/dashboard?new=1">
              <Plus className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="size-9 rounded-xl"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] border-r-brand-ink/15 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Pipnote menu</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="lg:pl-[268px]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
