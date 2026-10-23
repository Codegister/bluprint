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
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Terminal,
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
        "flex items-center gap-2.5 rounded-md border px-3 py-2 font-mono text-[11px] tracking-wide transition-colors",
        active
          ? "border-brand-pink/25 bg-brand-pink/10 text-brand-pink"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-brand-panel hover:text-brand-ink",
      )}
    >
      <span className="[&_svg]:size-4">{icon}</span>
      {children}
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ai = useQuery(api.settings.aiStatus);
  const dashboardActive =
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
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-1 pt-1">
        <Brand onNavigate={onNavigate} />
      </div>

      <Button
        asChild
        className="h-9 w-full rounded-md bg-brand-pink font-mono text-[11px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
      >
        <Link to="/dashboard?new=1" onClick={onNavigate}>
          <Plus className="size-3.5" />
          New set
        </Link>
      </Button>

      <nav className="flex flex-col gap-1">
        <p className="mono-label px-3 pb-2 text-muted-foreground/70">WORKSPACE</p>
        <NavItem
          to="/dashboard"
          active={dashboardActive}
          icon={<LayoutDashboard />}
          onClick={onNavigate}
        >
          DASHBOARD
        </NavItem>
        <NavItem
          to="/setup"
          active={location.pathname === "/setup"}
          icon={<KeyRound />}
          onClick={onNavigate}
        >
          API ACCESS
        </NavItem>
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <Link
          to="/setup"
          onClick={onNavigate}
          className={cn(
            "group rounded-lg border p-3 transition-colors",
            ai?.configured
              ? "border-brand-mint/20 bg-brand-mint/[0.06] hover:border-brand-mint/35"
              : "border-brand-lime/25 bg-brand-lime/[0.06] hover:border-brand-lime/40",
          )}
        >
          <div className="flex items-start gap-2">
            {ai === undefined ? (
              <Loader2 className="mt-0.5 size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Terminal
                className={cn(
                  "mt-0.5 size-3.5",
                  ai.configured ? "text-brand-mint" : "text-brand-lime",
                )}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="mono-label text-muted-foreground/70">MODEL ACCESS</p>
              <p
                className={cn(
                  "mt-1 text-[12px] font-medium",
                  ai?.configured ? "text-brand-mint" : "text-brand-lime",
                )}
              >
                {ai === undefined
                  ? "Checking…"
                  : ai.configured
                    ? "Pipeline ready"
                    : "Key required"}
              </p>
              <p className="mt-0.5 font-mono text-[9.5px] leading-relaxed text-muted-foreground">
                {ai?.configured
                  ? "NVIDIA_API_KEY connected"
                  : "Connect NVIDIA to compile sets"}
              </p>
            </div>
            <ArrowUpRight className="size-3 shrink-0 text-muted-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
        </Link>

        <div className="flex items-center gap-2.5 border-t border-border pt-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-brand-pink/25 bg-brand-pink/10 font-mono text-[11px] font-medium text-brand-pink">
            {initialFor(user?.name, user?.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-brand-ink">
              {displayName(user?.name, user?.email)}
            </p>
            <p className="truncate font-mono text-[9px] text-muted-foreground">
              {user?.email ?? "PRIVATE ACCOUNT"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            title="Sign out"
            className="rounded-md text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
            onClick={handleSignOut}
          >
            <LogOut className="size-3.5" />
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] border-r border-border bg-sidebar lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <Button
            asChild
            size="icon"
            aria-label="New set"
            className="size-9 rounded-md bg-brand-pink text-brand-void hover:bg-brand-pink-deep"
          >
            <Link to="/dashboard?new=1">
              <Plus className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="size-9 rounded-md text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[280px] border-r-border bg-sidebar p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Bluprint menu</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="lg:pl-[252px]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}
