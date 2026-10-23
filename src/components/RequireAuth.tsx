import { Brand } from "@/components/Brand";
import { Pip } from "@/components/Pip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Lock } from "lucide-react";
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
  description = "This page is only available to signed-in users.",
  redirectImmediately = false,
}: {
  children: ReactNode;
  /** Headline on the blocked screen. */
  title?: string;
  /** Says what the visitor gets by signing in. */
  description?: string;
  /** Skip the explanation and go straight to `/auth`. */
  redirectImmediately?: boolean;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-cream">
        <div className="grid size-20 place-items-center rounded-[24px] border-2 border-brand-ink bg-brand-lime">
          <Pip size={64} mood="sleepy" />
        </div>
        <Loader2 className="size-5 animate-spin text-brand-ink/35" />
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
      <div className="min-h-screen bg-brand-cream">
        <header className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-[12px] font-semibold text-brand-ink/45 hover:text-brand-ink"
          >
            Back home
          </button>
        </header>

        <main className="flex items-center justify-center px-4 pb-20 pt-10">
          <div className="w-full max-w-md rounded-[30px] border border-brand-ink/12 bg-white p-7 text-center sm:p-9">
            <div className="relative mx-auto w-fit">
              <div className="grid size-28 place-items-center rounded-[30px] border-2 border-brand-ink bg-brand-mint">
                <Pip size={96} cap />
              </div>
              <span className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-full border-2 border-brand-ink bg-brand-lime">
                <Lock className="size-4 text-brand-ink" />
              </span>
            </div>

            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ink/40">
              Private to your account
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight">{title}</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-ink/55">{description}</p>
            <p className="mt-2 text-[12px] text-brand-ink/40">
              You'll come straight back to this page once you're signed in.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => navigate(signInHref)}
                className="h-11 w-full rounded-xl border-2 border-brand-ink bg-brand-pink font-bold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream"
              >
                Sign in with email
              </Button>
              <Button
                variant="ghost"
                className="h-10 w-full rounded-xl font-semibold text-brand-ink/55 hover:bg-brand-cream hover:text-brand-ink"
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
