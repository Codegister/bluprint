import { DepthTransition } from "@/components/DepthTransition";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import AuthPage from "@/pages/Auth";
import Course from "@/pages/Course";
import Landing from "@/pages/Landing";
import PastPaper from "@/pages/PastPaper";
import RealPapers from "@/pages/RealPapers";
import StudySet from "@/pages/StudySet";
import Timetable from "@/pages/Timetable";
import Today from "@/pages/Today";
import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import "../index.css";
import "../redesign.css";
import "../stage.css";
import "../stage-study.css";
import "../stage-pages.css";
import "../principles.css";
import "./preview-fonts.css";

const previewParams = new URLSearchParams(window.location.search);
const screen = previewParams.get("screen");
const previewTheme = previewParams.get("theme") === "dark" ? "dark" : "light";
const initialPath =
  screen === "home"
    ? "/"
    : screen === "auth"
      ? "/auth"
      : screen === "timetable"
        ? "/timetable"
        : screen === "papers"
          ? "/papers"
          : screen === "paper-timer"
            ? "/papers/previewpaper000000000001"
            : screen === "set"
              ? "/sets/previewset000000000001"
              : screen === "quiz"
                ? "/sets/previewset000000000001/quiz"
                : screen === "course"
                  ? "/courses/previewcourse000000001"
                  : "/today";

function PreviewScreen() {
  if (screen === "home") return <Landing />;
  if (screen === "auth") return <AuthPage />;
  if (screen === "timetable") return <Timetable />;
  if (screen === "papers") return <RealPapers />;
  if (screen === "paper-timer") return <PastPaper />;
  if (screen === "set" || screen === "quiz") return <StudySet />;
  if (screen === "course") return <Course />;
  return <Today />;
}

// The preview defaults to light so a host machine in dark mode does not change
// the reference captures. `?theme=dark` is available for reviewing the dark
// palette without changing the viewer's stored preference.
try {
  window.localStorage.setItem("bluprint.theme", previewTheme);
} catch {
  // Storage is optional in the preview.
}

createRoot(document.getElementById("preview-root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <DepthTransition />
          <Routes>
            <Route path="/papers/:paperId" element={<PastPaper />} />
            <Route path="/sets/:setId" element={<StudySet />} />
            <Route path="/sets/:setId/:section" element={<StudySet />} />
            <Route path="/courses/:courseId" element={<Course />} />
            <Route path="/courses/:courseId/:section" element={<Course />} />
            <Route path="*" element={<PreviewScreen />} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
