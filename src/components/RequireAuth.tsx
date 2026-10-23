import { Brand } from "@/components/Brand";
import { BlueprintGlyph } from "@/components/BlueprintMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

/**
 * Wraps a route that requires a signed-in user.
 *
 * Signed-out visitors are told what they were trying to reach, and sign-in
 * returns them there via `returnTo`. Pass `redirectImmediately` for a route
 * where bouncing straight to `/auth` really is the better experience.
 */
export function RequireAuth({
  children,
  title = "Sign in to continue",
  description = "This page is restricted to signed-in accounts.",
  redirectImmediately = false,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  redirectImmediately?: boolean;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="grid size-16 place-items-center rounded-lg border border-border bg-brand-panel">
          <BlueprintGlyph size={56} className="opacity-80" />
        </div>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const signInHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

    if (redirectImmediately) {
      return <Navigate to={signInHref} replace />;
    }

    return (
      <div className="min-h-screen bg-background">
        <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <button
            type="button"
            onClick={() => navigate("/")}
            className="font-mono text-[9.5px] tracking-wide text-muted-foreground hover:text-brand-ink"
          >
            ← HOME
          </button>
        </header>

        <main className="flex items-center justify-center px-4 pb-20 pt-10">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-7 text-center sm:p-8">
            <div className="relative mx-auto grid size-24 place-items-center rounded-lg border border-border bg-brand-panel">
              <BlueprintGlyph size={84} className="opacity-80" />
              <span className="absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-md border border-brand-pink/30 bg-brand-pink/10">
                <Lock className="size-3.5 text-brand-pink" />
              </span>
            </div>

            <p className="mt-5 mono-label text-brand-pink">AUTH REQUIRED</p>
            <h1 className="mt-2 font-display text-2xl font-semibold leading-tight">
              {title}
            </h1>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>
            <p className="mt-2 font-mono text-[9px] tracking-wide text-muted-foreground/70">
              YOU'LL RETURN TO THIS PAGE AFTER SIGN-IN
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => navigate(signInHref)}
                className="h-10 w-full rounded-md bg-brand-pink font-mono text-[10.5px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
              >
                SIGN IN WITH EMAIL
                <ArrowRight className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                className="h-9 w-full rounded-md font-mono text-[10px] tracking-wide text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
                onClick={() => navigate("/")}
              >
                BACK TO HOME
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return children;
}
