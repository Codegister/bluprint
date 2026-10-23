import { Brand } from "@/components/Brand";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2 } from "lucide-react";
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
        <Mascot size={112} />
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
            className="rounded-full px-3 py-1.5 text-[0.85rem] font-semibold text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
          >
            ← Home
          </button>
        </header>

        <main className="flex items-center justify-center px-4 pb-20 pt-10">
          <div className="gizmo-card w-full max-w-md p-7 text-center sm:p-9">
            <div className="flex justify-center">
              <Mascot size={150} />
            </div>

            <h1 className="mt-3 text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink">
              {title}
            </h1>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
            <p className="mt-3 rounded-full bg-brand-panel px-3 py-1.5 text-[0.78rem] font-medium text-muted-foreground">
              You'll come back to this page after signing in
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => navigate(signInHref)}
                className="h-12 w-full rounded-full bg-[#191B27] text-[0.95rem] font-semibold text-white hover:bg-[#2A2D3E]"
              >
                Sign in with email
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-11 w-full rounded-full text-[0.9rem] font-semibold text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
                onClick={() => navigate("/")}
              >
                Back to home
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return children;
}
