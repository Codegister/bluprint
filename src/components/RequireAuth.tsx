import { Brand } from "@/components/Brand";
import { ChromeBackdrop } from "@/components/ChromeBackdrop";
import { Mascot } from "@/components/Mascot";
import { SkeletonText } from "@/components/Skeletons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
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
    // The auth check is usually a blink. Sketch the sign-in card rather than a
    // spinner, so the page settles into its real shape instead of jumping.
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center">
            <Mascot size={112} />
          </div>
          <div
            role="status"
            aria-busy="true"
            className="gizmo-card mt-3 space-y-4 p-7 sm:p-9"
          >
            <span className="sr-only">Checking your session</span>
            <Skeleton className="mx-auto h-6 w-3/4" />
            <SkeletonText lines={2} className="mx-auto max-w-xs" />
            <Skeleton className="h-12 w-full rounded-full" />
            <Skeleton className="mx-auto h-9 w-2/3 rounded-full" />
          </div>
        </div>
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
      <div className="min-h-screen">
        <ChromeBackdrop intensity={0.9} />
        <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-full px-3 py-1.5 text-[0.85rem] font-semibold text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
            >
              ← Home
            </button>
          </div>
        </header>

        <main className="flex items-center justify-center px-4 pb-20 pt-10">
          <motion.div
            className="gizmo-card w-full max-w-md p-7 text-center sm:p-9"
            {...enter(0.04, 16)}
          >
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            >
              <Mascot size={150} />
            </motion.div>

            <h1 className="chrome-title mt-3 text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em]">
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
          </motion.div>
        </main>
      </div>
    );
  }

  return children;
}
