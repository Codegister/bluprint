import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const CourseSetup = lazy(() => import("./pages/CourseSetup.tsx"));
const CoursePage = lazy(() => import("./pages/Course.tsx"));
const StudySet = lazy(() => import("./pages/StudySet.tsx"));
const Timetable = lazy(() => import("./pages/Timetable.tsx"));
const TimetableBuilder = lazy(() => import("./pages/TimetableBuilder.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
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

// Temporary migration override: the project's managed .env.local still points
// at the disabled Freebuff deployment. Remove this once VITE_CONVEX_URL points
// at the new project.
const MIGRATION_CONVEX_URL = "https://honorable-lyrebird-974.convex.cloud";
const configuredConvexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexUrl = configuredConvexUrl?.includes("honorable-lyrebird-974")
  ? configuredConvexUrl
  : MIGRATION_CONVEX_URL;
const convex = new ConvexReactClient(convexUrl);



function RouteSyncer() {
  const location = useLocation();
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


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
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
                path="/courses/:courseId"
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
                path="/sets/:setId"
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
              <Route
                path="/timetable/new"
                element={
                  <RequireAuth
                    title="Sign in to build a revision timetable"
                    description="Timetables are built from your own courses and exam dates."
                  >
                    <TimetableBuilder />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
