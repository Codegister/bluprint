import { useTheme } from "@/components/ThemeProvider";
import { LiquidMetal, Shader } from "shaders/react";
import { useState } from "react";

/**
 * The animated chrome ribbon behind the app.
 *
 * This uses the project's `shaders` (WebGPU) skill rather than hand-written
 * GLSL: `Shader` owns the canvas and context, and `LiquidMetal` draws the
 * flowing chrome. The light and dark colour pair comes from the same nine-step
 * ramp as the CSS tokens, so the shader and the interface stay in one palette.
 *
 * The layer is deliberately translucent and sits over the CSS metal ribbon in
 * `ChromeBackdrop`. If WebGPU is unavailable, the visitor asks for reduced
 * motion, or the shader simply has not painted yet, the CSS ribbon underneath
 * is already a complete backdrop, so there is never a blank page.
 */
export function ChromeShader({ className }: { className?: string }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  // Do not initialise a GPU context at all for visitors who ask for less
  // motion. The static CSS metal underneath is already the complete backdrop.
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  if (reducedMotion) return null;

  return (
    <div
      aria-hidden
      className={className ? `chrome-shader ${className}` : "chrome-shader"}
    >
      <Shader
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
        colorSpace="srgb"
        toneMapping="aces"
        disableTelemetry
      >
        <LiquidMetal
          // A single oversized sphere of molten metal, so the whole backdrop
          // catches the studio light rather than showing a small floating blob.
          scale={3.1}
          center={{ x: 0.52, y: 0.48 }}
          rotation={dark ? 18 : 0}
          lightColor={dark ? "#eef1f4" : "#ffffff"}
          darkColor={dark ? "#07090b" : "#20252b"}
          turbulence={1.05}
          ripple={2.4}
          warp={1.15}
          speed={0.2}
          environment={dark ? 1.1 : 1.4}
          envRotation={dark ? 120 : 210}
          sharpness={0.58}
          dispersion={dark ? 0.1 : 0.16}
          bevelWidth={0.08}
          edgeSoftness={0.22}
        />
      </Shader>
    </div>
  );
}

export default ChromeShader;
