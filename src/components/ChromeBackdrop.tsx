import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * The app's paper backdrop.
 *
 * The Gizmo look is stationery rather than metal: a cream page, a faint dot
 * grid, and two blurred highlighter smudges (lime and lilac) drifting slowly
 * behind the content. The blobs animate transform only, so they stay on the
 * compositor and never repaint the page. Nothing here is interactive or read
 * by a screen reader.
 *
 * `variant="page"` pins the backdrop behind the whole screen; the panel
 * variant fills whatever positioned, rounded container it is dropped into.
 * The tokens live in `index.css` and switch automatically with the dark theme.
 */
export function ChromeBackdrop({
  variant = "page",
  /** 0-1. Lower values let more of the surface underneath show through. */
  intensity = 1,
  className,
}: {
  variant?: "page" | "panel";
  intensity?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "chrome-backdrop",
        variant === "page" && "chrome-backdrop-page",
        className,
      )}
      style={{ "--chrome-intensity": intensity } as CSSProperties}
    >
      <span className="chrome-backdrop-base" />
      {/* Three gradient ribbons crossing the page at different speeds. This is
          what makes the backdrop read as moving light rather than a static
          wash; the smudges and dot grid sit on top of it. */}
      <span className="gizmo-flow">
        <span className="gizmo-ribbon gizmo-ribbon-lime" />
        <span className="gizmo-ribbon gizmo-ribbon-lilac" />
        <span className="gizmo-ribbon gizmo-ribbon-sky" />
      </span>
      <span className="gizmo-blob gizmo-blob-lime" />
      <span className="gizmo-blob gizmo-blob-lilac" />
      <span className="gizmo-blob gizmo-blob-peach" />
      <span className="gizmo-dots" />
    </div>
  );
}

export default ChromeBackdrop;
