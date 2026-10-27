import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

/**
 * Ink in water.
 *
 * A canvas field of soft pigment plumes drifting through a slow curl, drawn
 * with pre-rendered sprites so each frame is a handful of `drawImage` calls
 * rather than a gradient rebuild. Overlapping plumes build the density of real
 * ink; short position trails give each plume the wispy tail you get when a
 * drop of ink is dropped into a glass.
 *
 * The canvas uses `mix-blend-mode: multiply` in the light theme (dye on paper)
 * and `screen` in the dark theme (ink blooming in dark water); both are set in
 * index.css. Each theme gets its own pigment set: pale, light dyes on paper,
 * and deep, dark inks that lift off the near-black page. The sprites are
 * re-rendered when the theme class changes, so a toggle recolours the plumes
 * in place rather than leaving a light-mode wash on a dark screen.
 *
 * Decorative only: the element is aria-hidden, the loop pauses when the graphic
 * scrolls out of view or the tab is hidden, and a static frame is drawn for
 * visitors who ask for reduced motion.
 */

type Pigment = { rgb: string; weight: number };
type Theme = "light" | "dark";

type Palette = {
  key: Theme;
  /** Multiplies plume opacity; multiply blending needs a firmer hand. */
  strength: number;
  pigments: Pigment[];
};

/**
 * Light theme (a flat neutral page): one chrome-blue accent, at low strength.
 * Dark theme: deep ink (indigo, forest, teal, plum, umber). Screen blending
 * lifts them off the near-black sheet without turning them into pale fog.
 * A puff keeps its sprite index across a theme switch; drawing falls back to
 * the first pigment when the new palette is shorter.
 */
const PALETTES: Record<Theme, Palette> = {
  light: {
    key: "light",
    // A flat neutral page: the plumes are a single graphite tint, so the
    // background stays near-solid instead of carrying a blue gradient.
    strength: 0.9,
    pigments: [{ rgb: "122, 135, 148", weight: 1 }],
  },
  dark: {
    key: "dark",
    strength: 2.2,
    pigments: [
      { rgb: "26, 92, 58", weight: 3 }, // deep forest
      { rgb: "54, 40, 120", weight: 2 }, // deep indigo
      { rgb: "16, 74, 108", weight: 2 }, // deep petrol
      { rgb: "12, 86, 78", weight: 1 }, // deep teal
      { rgb: "96, 52, 28", weight: 1 }, // deep umber
    ],
  },
};

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

const MAX_PUFFS = 260;

type Puff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  grow: number;
  life: number;
  maxLife: number;
  seed: number;
  alpha: number;
  sprite: number;
};

/** Picks a pigment by weight, so the first (lime / forest) appears most often. */
function pickPigment(pigments: Pigment[]): number {
  const total = pigments.reduce((sum, pigment) => sum + pigment.weight, 0);
  let roll = Math.random() * total;
  for (let index = 0; index < pigments.length; index += 1) {
    roll -= pigments[index].weight;
    if (roll <= 0) return index;
  }
  return 0;
}

/** A soft radial sprite: one per pigment, reused for every plume. */
function makeSprites(pigments: Pigment[]): HTMLCanvasElement[] {
  return pigments.map(({ rgb }) => {
    const size = 128;
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const ctx = sprite.getContext("2d");
    if (!ctx) return sprite;
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, `rgba(${rgb}, 1)`);
    gradient.addColorStop(0.32, `rgba(${rgb}, 0.62)`);
    gradient.addColorStop(0.62, `rgba(${rgb}, 0.24)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.fill();
    return sprite;
  });
}

function makePuff(
  width: number,
  height: number,
  initial: boolean,
  palette: Palette,
): Puff {
  // Emitters sit along the edges and across the middle, so the plumes look
  // like they were released into the water rather than laid out in a grid.
  const emitter = Math.random();
  let x: number;
  let y: number;
  if (emitter < 0.4) {
    x = width * (0.04 + Math.random() * 0.16);
    y = height * (0.1 + Math.random() * 0.85);
  } else if (emitter < 0.75) {
    x = width * (0.68 + Math.random() * 0.28);
    y = height * (0.02 + Math.random() * 0.5);
  } else {
    x = width * (0.25 + Math.random() * 0.55);
    y = height * (0.65 + Math.random() * 0.3);
  }

  const maxLife = 360 + Math.random() * 480;
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.4,
    // Large blooms that stay readable from across the page: the pigment should
    // be seen moving, not inferred from a faint tint under the headline.
    radius: 40 + Math.random() * 88,
    grow: 0.14 + Math.random() * 0.24,
    // Pre-seeded plumes start part-way through their life so the first frame
    // already shows a developed bloom.
    life: initial ? Math.random() * maxLife : 0,
    maxLife,
    seed: Math.random() * Math.PI * 2,
    alpha: 0.12 + Math.random() * 0.14,
    sprite: pickPigment(palette.pigments),
  };
}

export function InkInWater({
  className,
  intensity = 1,
}: {
  className?: string;
  /** 0-1 scale for the number of plumes and their opacity. */
  intensity?: number;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const holder = holderRef.current;
    const canvas = canvasRef.current;
    if (!holder || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // The page theme decides both the pigments and how firmly they are laid
    // down. Reading the class (rather than a media query) follows a manual
    // toggle as well as the OS default.
    let palette = PALETTES[currentTheme()];
    let sprites = makeSprites(palette.pigments);

    let width = 0;
    let height = 0;
    let puffs: Puff[] = [];
    let frame = 0;
    let running = false;
    let visible = true;
    let last = 0;
    let time = 0;

    const drawPuff = (puff: Puff, alpha: number, radius: number, x: number, y: number) => {
      // The light theme has a single pigment, so a puff that entered in the
      // dark theme keeps its position and borrows the first sprite after a
      // theme switch instead of drawing an undefined image.
      const sprite = sprites[puff.sprite] ?? sprites[0];
      if (!sprite) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (const puff of puffs) {
        // Fade in on release and out as the pigment disperses.
        const progress = Math.min(1, puff.life / puff.maxLife);
        const envelope = Math.sin(Math.PI * progress) ** 1.35;
        const alpha = puff.alpha * envelope * palette.strength;
        if (alpha <= 0.002) continue;

        // Two wake points along the velocity vector stretch the puff into a
        // teardrop. As the curl field turns the plume, the wake bends with it,
        // which is what makes the field read as ink rather than soft fog.
        const speed = Math.hypot(puff.vx, puff.vy);
        if (speed > 0.2) {
          drawPuff(
            puff,
            alpha * 0.34,
            puff.radius * 0.78,
            puff.x - puff.vx * 12,
            puff.y - puff.vy * 12,
          );
          drawPuff(
            puff,
            alpha * 0.16,
            puff.radius * 0.55,
            puff.x - puff.vx * 26,
            puff.y - puff.vy * 26,
          );
        }
        drawPuff(puff, alpha, puff.radius, puff.x, puff.y);
      }
      ctx.globalAlpha = 1;
    };

    const step = (delta: number, now: number) => {
      time = now;
      const seconds = delta / 1000;
      // Clamp the step so a tab that was asleep does not teleport every plume.
      const speed = Math.min(seconds, 1 / 24);
      const t = time * 0.00022;

      // A vortex centre that orbits the canvas. The tangential flow below turns
      // plumes around it, so the field visibly stirs instead of drifting on a
      // near-straight path.
      const vortexX = width * (0.5 + Math.sin(t * 1.6) * 0.3);
      const vortexY = height * (0.5 + Math.cos(t * 1.2) * 0.28);

      for (const puff of puffs) {
        puff.life += delta * 0.06;
        if (
          puff.life > puff.maxLife ||
          puff.x < -puff.radius * 2 ||
          puff.x > width + puff.radius * 2 ||
          puff.y < -puff.radius * 2 ||
          puff.y > height + puff.radius * 2
        ) {
          Object.assign(puff, makePuff(width, height, false, palette));
          continue;
        }

        // A curl field: the two sine terms push neighbouring plumes in
        // slightly different directions, which is what makes the ink fold and
        // swirl instead of drifting in straight lines.
        let flowX =
          Math.sin(puff.y * 0.0045 + t * 3.4 + puff.seed) * 32 +
          Math.cos(puff.y * 0.0018 - t * 1.7) * 14;
        let flowY =
          Math.cos(puff.x * 0.0038 - t * 2.6 + puff.seed * 1.6) * 28 +
          Math.sin(puff.x * 0.0015 + t * 1.2) * 12;

        // Tangential pull around the moving vortex, strongest near its centre
        // and fading out with distance. This is the part that makes the ink
        // travel around the screen rather than sit under the headline.
        const dx = puff.x - vortexX;
        const dy = puff.y - vortexY;
        const distance = Math.hypot(dx, dy) + 1;
        const pull = Math.min(1, 320 / distance);
        flowX += (-dy / distance) * 46 * pull;
        flowY += (dx / distance) * 46 * pull;

        puff.vx = puff.vx * 0.986 + flowX * speed * 0.02;
        puff.vy = puff.vy * 0.986 + flowY * speed * 0.02;
        puff.radius += puff.grow * delta * 0.06;

        // A firm multiplier: the plumes should be seen crossing the glass, not
        // inferred from a tint that barely changes.
        puff.x += puff.vx * speed * 38;
        puff.y += puff.vy * speed * 38;
      }

      render();
    };

    const loop = (now: number) => {
      if (!running) return;
      const delta = last ? Math.min(now - last, 64) : 16.67;
      last = now;
      step(delta, now);
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (reducedMotion || running || !visible) return;
      running = true;
      last = 0;
      frame = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const resize = () => {
      const rect = holder.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.round(
        Math.min(MAX_PUFFS, Math.max(90, (width * height) / 7200)) *
          Math.max(0.35, Math.min(1.5, intensity)),
      );
      if (puffs.length > target) puffs = puffs.slice(0, target);
      while (puffs.length < target) {
        puffs.push(makePuff(width, height, true, palette));
      }
      // The canvas is cleared by resize, so a reduced-motion visitor still gets
      // a composition rather than a blank layer.
      if (reducedMotion) {
        for (const puff of puffs) {
          puff.life = Math.random() * puff.maxLife;
        }
        render();
      } else {
        last = 0;
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(holder);
    resize();

    // Re-ink on a theme change. The puffs keep their positions and sprite
    // indices; only the pigment behind each index changes.
    const themeObserver = new MutationObserver(() => {
      const next = PALETTES[currentTheme()];
      if (next.key === palette.key) return;
      palette = next;
      sprites = makeSprites(palette.pigments);
      if (width > 0) render();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let intersection: IntersectionObserver | null = null;
    if (!reducedMotion) {
      // Off-screen or hidden tabs cost nothing: the loop is cancelled.
      intersection = new IntersectionObserver(
        (entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
          if (visible) start();
          else stop();
        },
        { threshold: 0.01 },
      );
      intersection.observe(holder);
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Set the static frame when animation is off; the observer still starts the
    // loop for everyone else once the hero is on screen.
    if (!reducedMotion && holder.getBoundingClientRect().top < window.innerHeight) {
      start();
    }

    return () => {
      stop();
      observer.disconnect();
      themeObserver.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intensity]);

  return (
    <div ref={holderRef} aria-hidden className={cn("ink-water", className)}>
      <canvas ref={canvasRef} />
    </div>
  );
}

/**
 * The app-wide ink layer.
 *
 * Fixed above the chrome backdrop and below every in-flow surface, so each
 * screen gets the same moving pigment without it covering text or catching a
 * click. Signed-in screens mount it beside the backdrop in the app shell; the
 * public screens mount it next to their own backdrop.
 */
export function PageInk({ intensity = 1.1 }: { intensity?: number }) {
  return (
    <div aria-hidden className="ink-page">
      <InkInWater intensity={intensity} />
    </div>
  );
}

export default InkInWater;
