/**
 * The app's boot entry.
 *
 * The public Home is already painted from index.html and its form is wired by
 * home-boot.js, so a signed-out visitor does not need the React/Convex bundle
 * before they can type. Start that bundle when the browser is idle, keeping the
 * initial JavaScript path to this file plus the two small public scripts.
 *
 * Every other route, and Home for someone with a stored session, needs the app
 * straight away.
 */
import "./index.css";
import "./redesign.css";
import "./stage.css";
import "./stage-study.css";
import "./stage-pages.css";
import "./principles.css";
import "./palette.css";
import "./neon.css";
import { hasStoredAuthSession } from "./lib/authSession";

function isHomePath(pathname: string): boolean {
  const path = pathname.replace(/index\.html$/, "");
  return path === "/" || path === "/bluprint" || path === "/bluprint/";
}

function loadApp(): void {
  void import("./main");
}

const signedOutHome =
  isHomePath(window.location.pathname) && !hasStoredAuthSession();

if (signedOutHome) {
  // requestIdleCallback gives the browser a chance to paint the static hero
  // and run the form's tiny handler first. The timeout is a ceiling for
  // browsers that stay busy, not a delay on a quiet one.
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadApp, { timeout: 1200 });
  } else {
    setTimeout(loadApp, 800);
  }
} else {
  loadApp();
}
