import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import AuthPage from "@/pages/Auth";
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
import "./preview-fonts.css";

const screen = new URLSearchParams(window.location.search).get("screen");
const initialPath =
  screen === "auth" ? "/auth" : screen === "timetable" ? "/timetable" : "/today";

function PreviewScreen() {
  if (screen === "auth") return <AuthPage />;
  if (screen === "timetable") return <Timetable />;
  return <Today />;
}

// The preview is always light, so a host machine in dark mode does not change
// the screenshots. The stage tokens are the same in either mode.
try {
  window.localStorage.setItem("bluprint.theme", "light");
} catch {
  // Storage is optional in the preview.
}

createRoot(document.getElementById("preview-root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="*" element={<PreviewScreen />} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
