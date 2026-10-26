import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { MotionConfig, motion } from "framer-motion";
import React, {
  StrictMode,
  useEffect,
  useLayoutEffect,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const CourseSetup = lazy(() => import("./pages/CourseSetup.tsx"));
const CoursesPage = lazy(() => import("./pages/Courses.tsx"));
const CoursePage = lazy(() => import("./pages/Course.tsx"));
const PastPaperPage = lazy(() => import("./pages/PastPaper.tsx"));
const StudySet = lazy(() => import("./pages/StudySet.tsx"));
const Timetable = lazy(() => import("./pages/Timetable.tsx"));
const TimetableBuilder = lazy(() => import("./pages/TimetableBuilder.tsx"));
const Tutor = lazy(() => import("./pages/Tutor.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

/**
 * Fallback while a route's code chunk is fetched. It is intentionally silent:
 * a page-shaped skeleton keeps the screen steady instead of flashing a
 * "Loading..." label that disappears before it can be read.
 */
function RouteLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen px-4 py-7 sm:px-6 lg:px-10 lg:py-10"
    >
      <span className="sr-only">Loading page</span>
      <div className="mx-auto w-full max-w-[1080px] space-y-5">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-2/3 max-w-sm" />
          <Skeleton className="h-3.5 w-1/2 max-w-xs" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Skeleton className="h-72 rounded-[1.7rem]" />
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-[1.7rem]" />
            <Skeleton className="h-32 rounded-[1.7rem]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Silent error boundary: if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Pinned to the deployment that holds this project's courses and server
// environment. A stale VITE_CONVEX_URL must not point the browser at another
// deployment. The address has to be the .cloud host with no trailing slash,
// because Convex appends "/api/..." to it and "//api/..." fails to sync.
const CONVEX_URL = "https://honorable-lyrebird-974.convex.cloud";
const convex = new ConvexReactClient(CONVEX_URL);

function RouteSyncer() {
  const location = useLocation();

  // A new screen starts at the top. Hash links (e.g. /dashboard#courses) keep
  // their smooth in-page scroll, so they are left alone.
  useLayoutEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/**
 * Soft fade between screens. Opacity only, deliberately: transforming the
 * route wrapper would give the fixed sidebar a new containing block and make
 * it drift. The keyed child restarts the fade on each new path.
 */
function RouteFade({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  // The timetable builder is one screen whose four steps live in the URL.
  // Keying on the full path used to remount it on every step, discarding the
  // subjects chosen so far; those steps keep the same key (and no fade).
  const screenKey = pathname.startsWith("/timetable/new")
    ? "/timetable/new"
    : pathname;
  return (
    <motion.div
      key={screenKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen"
    >
      {children}
    </motion.div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <MotionConfig reducedMotion="user">
        {/* Theme lives above the router so every screen, dialog and toast
            shares one light / high-contrast-dark state. */}
        <ThemeProvider>
          <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <RouteSyncer />
            <RouteFade>
              <Suspense fallback={<RouteLoading />}>
                <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth
                    title="Sign in to see your study sets"
                    description="Your sets, progress and quiz scores live in your account."
                  >
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/courses/new"
                element={
                  <RequireAuth
                    title="Sign in to set up your courses"
                    description="Course pathways are mapped to your account and your exam board."
                  >
                    <CourseSetup />
                  </RequireAuth>
                }
              />
              <Route
                path="/courses"
                element={
                  <RequireAuth
                    title="Sign in to see your courses"
                    description="Course pathways are private to the account that created them."
                  >
                    <CoursesPage />
                  </RequireAuth>
                }
              />
              {/* Pathway, past papers, topic papers and study sets are separate
                  screens, so each one opens with a single job in view. */}
              <Route
                path="/courses/:courseId/:section?"
                element={
                  <RequireAuth
                    title="Sign in to open this course"
                    description="Course pathways are private to the account that created them."
                  >
                    <CoursePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/papers/:paperId"
                element={
                  <RequireAuth
                    title="Sign in to sit this past paper"
                    description="Past papers are saved to the account that built them."
                  >
                    <PastPaperPage />
                  </RequireAuth>
                }
              />
              {/* The set overview and each study mode are separate screens. */}
              <Route
                path="/sets/:setId/:section?"
                element={
                  <RequireAuth
                    title="Sign in to open this study set"
                    description="Study sets are private to the account that created them."
                  >
                    <StudySet />
                  </RequireAuth>
                }
              />
              <Route
                path="/timetable"
                element={
                  <RequireAuth
                    title="Sign in to see your revision timetable"
                    description="Your timetable and course topics live in your account."
                  >
                    <Timetable />
                  </RequireAuth>
                }
              />
              {/* The builder runs as four pages; the step is in the URL so each
                  one can be linked, reloaded and navigated back. One splat route
                  covers all four, so changing step keeps the page (and the
                  choices made so far) mounted. */}
              <Route
                path="/timetable/new/*"
                element={
                  <RequireAuth
                    title="Sign in to build a revision timetable"
                    description="Timetables are built from your own courses and exam dates."
                  >
                    <TimetableBuilder />
                  </RequireAuth>
                }
              />
              <Route
                path="/tutor"
                element={
                  <RequireAuth
                    title="Sign in to use the AI tutor"
                    description="The tutor uses your notes, courses and study sets."
                  >
                    <Tutor />
                  </RequireAuth>
                }
              />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RouteFade>
            <Toaster />
          </BrowserRouter>
          </ConvexAuthProvider>
        </ThemeProvider>
      </MotionConfig>
    </RootErrorBoundary>
  </StrictMode>,
);
