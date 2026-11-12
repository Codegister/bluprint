import { useEffect } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, "");

/**
 * The one depth move in the product: opening a study set changes the stage
 * into the desk. Every set link gets the browser's View Transitions API when
 * it is available. The fallback is a plain 200ms cross-fade, and reduced
 * motion cuts straight to the destination.
 */
export function DepthTransition() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return;

      const path = BASE_PATH && url.pathname.startsWith(BASE_PATH)
        ? url.pathname.slice(BASE_PATH.length)
        : url.pathname;
      if (!/^\/sets\/[^/]+/.test(path)) return;
      if (location.pathname.startsWith("/sets/")) return;

      event.preventDefault();
      event.stopPropagation();

      const go = () => {
        flushSync(() => navigate(`${path}${url.search}${url.hash}`));
      };
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const doc = document as ViewTransitionDocument;

      if (reduce) {
        go();
        return;
      }

      if (doc.startViewTransition) {
        const transition = doc.startViewTransition(go);
        transition.finished.finally(() => {
          document.documentElement.classList.remove("depth-fallback");
        });
        return;
      }

      document.documentElement.classList.add("depth-fallback");
      go();
      window.setTimeout(() => {
        document.documentElement.classList.remove("depth-fallback");
      }, 220);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [location.pathname, navigate]);

  return null;
}
