import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import {
  LightLeak,
  MeshGradient,
  Shader,
  Vignette,
  isWebGPUSupported,
} from "shaders/react";
import { Component, useEffect, useState, type ReactNode } from "react";

/**
 * Premium animated backdrop for the app's large "hero" surfaces.
 *
 * Layers, back to front:
 *   1. A CSS gradient. This is the fallback and is always painted, so a browser
 *      without WebGPU (or a failed GPU adapter) still gets the same palette.
 *   2. A WebGPU mesh gradient with a soft light leak, drawn by the `shaders`
 *      library. Skipped when WebGPU is unavailable or the visitor has asked
 *      for reduced motion.
 *   3. A static film grain, drawn in CSS. It costs nothing per frame and gives
 *      the flat gradient a printed, premium finish.
 *
 * The whole thing is decorative: it is aria-hidden and never intercepts
 * pointer events, so content above it behaves exactly as before.
 */

type Palette = {
  stops: { color: string; position: number }[];
  fallback: string;
  grainOpacity: number;
  grainBlend: "overlay" | "soft-light";
  vignette: { color: string; intensity: number };
  leak: { hot: string; mid: string; fringe: string; intensity: number };
};

// Warm paper, lilac, blush, butter and mint - the same family as the theme
// tokens in index.css, arranged as one soft wash.
const LIGHT: Palette = {
  stops: [
    { color: "#FBF7FF", position: 0 },
    { color: "#EADBFF", position: 0.24 },
    { color: "#FFE3EE", position: 0.47 },
    { color: "#FFF3D9", position: 0.7 },
    { color: "#DDF5EB", position: 0.87 },
    { color: "#F8F6F1", position: 1 },
  ],
  fallback: [
    "radial-gradient(70% 62% at 8% 0%, #E9DBFF 0%, transparent 62%)",
    "radial-gradient(55% 55% at 88% 6%, #FFDDEC 0%, transparent 60%)",
    "radial-gradient(62% 55% at 78% 96%, #D8F3E9 0%, transparent 62%)",
    "radial-gradient(50% 50% at 18% 100%, #FFF0CC 0%, transparent 60%)",
    "linear-gradient(155deg, #FBF7FF 0%, #F7F6F2 55%, #FDF9F2 100%)",
  ].join(", "),
  grainOpacity: 0.12,
  grainBlend: "overlay",
  vignette: { color: "#2A1A55", intensity: 0.1 },
  leak: { hot: "#FFFFFF", mid: "#E7D6FF", fringe: "#FFE2EE", intensity: 0.16 },
};

// The dark theme keeps the same hues, lifted into deep indigo and plum so the
// wash reads as a lit surface rather than a grey rectangle.
const DARK: Palette = {
  stops: [
    { color: "#0A0814", position: 0 },
    { color: "#2A1A5E", position: 0.26 },
    { color: "#45163F", position: 0.49 },
    { color: "#2A2109", position: 0.7 },
    { color: "#08282C", position: 0.88 },
    { color: "#05060A", position: 1 },
  ],
  fallback: [
    "radial-gradient(80% 70% at 10% 0%, #2B1B5E 0%, transparent 62%)",
    "radial-gradient(60% 60% at 90% 8%, #4A1640 0%, transparent 60%)",
    "radial-gradient(70% 60% at 80% 96%, #062A2E 0%, transparent 62%)",
    "radial-gradient(60% 60% at 20% 100%, #2B1F08 0%, transparent 60%)",
    "linear-gradient(160deg, #0A0814 0%, #05060A 100%)",
  ].join(", "),
  grainOpacity: 0.2,
  grainBlend: "soft-light",
  vignette: { color: "#000000", intensity: 0.5 },
  leak: { hot: "#FFFFFF", mid: "#C9B2FF", fringe: "#FFB9D6", intensity: 0.28 },
};

/** A single static noise tile, encoded once at module scope. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>" +
    "<feColorMatrix type='saturate' values='0'/></filter>" +
    "<rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

/** Decorative effects must never take the page down with them, so a shader
 *  failure quietly removes the canvas and leaves the CSS gradient. */
class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[ShaderBackdrop] Disabled after an error:", error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function ShaderBackdrop({
  className,
  /** 0-1. Lower values let more of the page background show through. */
  intensity = 1,
}: {
  className?: string;
  intensity?: number;
}) {
  const { theme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [gpuReady, setGpuReady] = useState(false);
  const palette = theme === "dark" ? DARK : LIGHT;

  // Checked after mount: WebGPU lives on `navigator`, which is not available
  // while the module is first evaluated in some preview environments.
  useEffect(() => {
    setGpuReady(isWebGPUSupported());
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0" style={{ background: palette.fallback }} />

      {gpuReady && !reducedMotion && (
        <ShaderBoundary>
          <div className="absolute inset-0" style={{ opacity: intensity }}>
            <Shader
              className="h-full w-full"
              colorSpace="srgb"
              toneMapping="aces"
              disableTelemetry
              // The CSS gradient underneath is the fallback, so a failed adapter
              // simply leaves it in place rather than showing an empty canvas.
              onUnavailable={() => setGpuReady(false)}
            >
              <MeshGradient
                stops={palette.stops}
                colorA={palette.stops[0].color}
                colorB={palette.stops[4].color}
                colorSpace="oklab"
                count={5}
                smoothness={2.1}
                variation={0.45}
                swirl={0.24}
                drift={0.5}
                speed={0.5}
                seed={theme === "dark" ? 23 : 12}
              />
              <LightLeak
                position={{ x: 0.86, y: 0.12 }}
                spread={0.5}
                intensity={palette.leak.intensity}
                streaks={0.35}
                colorHot={palette.leak.hot}
                colorMid={palette.leak.mid}
                colorFringe={palette.leak.fringe}
                flicker={0.18}
                speed={0.6}
                seed={7}
              />
              <Vignette
                color={palette.vignette.color}
                center={{ x: 0.5, y: 0.45 }}
                radius={0.55}
                falloff={0.85}
                intensity={palette.vignette.intensity}
              />
            </Shader>
          </div>
        </ShaderBoundary>
      )}

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: GRAIN,
          backgroundRepeat: "repeat",
          opacity: palette.grainOpacity,
          mixBlendMode: palette.grainBlend,
        }}
      />
    </div>
  );
}

export default ShaderBackdrop;
