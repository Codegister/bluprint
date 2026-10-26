import { ChromeShader } from "@/components/ChromeShader";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * The app's chrome-metal backdrop.
 *
 * Five layers:
 *   1. base   - a neutral silver wash with a lit top-left edge.
 *   2. metal  - the CSS ribbon: the complete backdrop when WebGPU is not there.
 *   3. shader - the WebGPU liquid-chrome ribbon layered over the CSS metal.
 *   4. sweep  - a single specular highlight crossing the surface.
 *   5. brush  - static hairlines, the machined texture.
 *
 * The CSS layers animate only `transform`, so they are painted by the
 * compositor rather than the main thread. Nothing here is interactive or read
 * by a screen reader. `variant="page"` pins the backdrop behind the whole
 * screen; the panel variant fills whatever positioned, rounded container it is
 * dropped into.
 *
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
      <span className="chrome-backdrop-metal" />
      <ChromeShader />
      <span className="chrome-backdrop-sweep" />
      <span className="chrome-backdrop-brush" />
    </div>
  );
}

export default ChromeBackdrop;
