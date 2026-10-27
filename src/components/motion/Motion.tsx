/**
 * The app's motion vocabulary.
 *
 * Everything animated in Bluprint pulls its curve, duration and distance from
 * this file. That is what stops a page of small animations from feeling like a
 * dozen different apps: one ease, one lift, one stagger rhythm.
 *
 * Accessibility: <MotionConfig reducedMotion="user"> is set once in main.tsx,
 * so Framer automatically drops transform/layout motion when the visitor's OS
 * asks for reduced motion. The CSS keyframes have the same guard in index.css.
 */
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  type MotionProps,
  type Transition,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The three motion rules, in one place:
 *
 * 1. Entrance — start fast, end slow. Expo-out, so the element arrives
 *    immediately and spends the rest of the curve settling.
 * 2. Exit — start slow, end fast. Ease-in, so the element lingers a beat and
 *    then leaves quickly rather than fading at a constant rate.
 * 3. Interface — overshoot, then settle. A lightly underdamped spring, so a
 *    nav pill, hover lift or tap lands just past its target and eases back.
 */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_EXIT: [number, number, number, number] = [0.7, 0, 0.84, 0];
/** Symmetric ease for loops (drift, spin, shimmer). */
export const EASE_LOOP: [number, number, number, number] = [0.45, 0, 0.55, 1];

/** The house spring for hover/tap and layout moves. */
export const SPRING: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 22,
  mass: 0.9,
};

/**
 * Props for any element that should rise into place when scrolled to. Spread
 * onto a motion element so the DOM structure (and therefore the layout) is left
 * exactly as it was:
 *
 *   <motion.li {...reveal(index * 0.06)} className="...">
 *
 * `once: false` on purpose: the entrance is a response to scrolling, not a
 * one-time page load. Leaving the viewport resets the element to its hidden
 * state, so scrolling back up (or down again) replays it every time.
 */
export function reveal(delay = 0, distance = 14): MotionProps {
  return {
    initial: { opacity: 0, y: distance },
    whileInView: { opacity: 1, y: 0 },
    // "some" rather than a fraction: a pathway with ten expanded units is far
    // taller than a phone screen, so 20% of it can never be visible at once and
    // the whole section stayed at opacity 0. Any visible sliver now reveals it.
    viewport: { once: false, amount: "some", margin: "0px 0px -24px 0px" },
    // Shorter travel and a slightly quicker curve: the entrance is still
    // noticeable but it settles before the next scroll frame arrives.
    transition: { duration: 0.5, ease: EASE, delay },
  };
}

/** Same idea, but for content that is already on screen at mount (hero/headers). */
export function enter(delay = 0, distance = 14): MotionProps {
  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE, delay },
  };
}

/** Container variants for a stagger that runs on mount. */
export const staggerOnMount = (gap = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: gap, delayChildren: delay },
  },
});

/** Child variants for either stagger container. */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export const staggerChildScale: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE },
  },
};

/** Fade + rise wrapper, for one-off blocks that cannot take motion props. */
export function Reveal({
  children,
  delay = 0,
  distance = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  className?: string;
}) {
  return (
    <motion.div className={className} {...reveal(delay, distance)}>
      {children}
    </motion.div>
  );
}

/**
 * Staggered entrance. Animates on mount by default; set `inView` for sections
 * below the fold so the sequence plays when they are seen, and replays whenever
 * they are scrolled back into view. Use with <StaggerItem> children when extra
 * wrappers are safe, otherwise spread `enter()`/`reveal()` on the real elements.
 */
export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0,
  inView = false,
  amount = 0.15,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  inView?: boolean;
  amount?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      {...(inView
        ? { whileInView: "show", viewport: { once: false, amount } }
        : { animate: "show" })}
      variants={staggerOnMount(gap, delay)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  scale = false,
}: {
  children: ReactNode;
  className?: string;
  scale?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={scale ? staggerChildScale : staggerChild}
    >
      {children}
    </motion.div>
  );
}

/**
 * A number that counts up each time it scrolls into view. Used for dashboard
 * tiles and course stats. It rewinds while off screen so the count-up replays
 * on the next entry rather than sitting on its final value. Falls back to the
 * final value instantly when reduced motion is requested.
 */
export function Counter({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.1,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.4 });
  const [shown, setShown] = useState(0);
  // The tween's current value, so live changes count from where the number is
  // rather than restarting at zero.
  const current = useRef(0);
  const display = reduce ? value : shown;

  // Off screen: put the number back to zero (silently, nobody can see it) so
  // the next scroll into view counts up from the start again.
  useEffect(() => {
    if (inView || reduce) return;
    current.current = 0;
    setShown(0);
  }, [inView, reduce]);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(current.current, value, {
      duration: current.current === 0 ? duration : 0.6,
      ease: EASE,
      onUpdate: (latest) => {
        current.current = latest;
        setShown(latest);
      },
    });
    return () => controls.stop();
  }, [inView, value, reduce, duration]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/**
 * Progress bar whose fill grows into place. Width is animated rather than a
 * CSS transition so it starts when the bar is actually visible.
 */
export function Meter({
  value,
  className,
  barClassName,
  barStyle,
  delay = 0,
  duration = 0.9,
  label,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  barStyle?: React.CSSProperties;
  delay?: number;
  duration?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-brand-panel",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      {/* The fill animates its transform, not its width: the bar grows without
          the browser recomputing layout on every frame. */}
      <motion.div
        className={cn("h-full origin-left rounded-full", barClassName)}
        style={{ ...barStyle, width: `${clamped}%` }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: false, amount: 0.6 }}
        transition={{ duration, ease: EASE, delay }}
      />
    </div>
  );
}

/**
 * A slow, endless float. `distance` and `duration` are in px/seconds so a
 * layered illustration can give each element its own drift.
 */
export function Floating({
  children,
  className,
  distance = 8,
  duration = 7,
  delay = 0,
  rotate = 0,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
  delay?: number;
  rotate?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0], rotate: [0, rotate, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: EASE_LOOP,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Three dots that lift in sequence while the tutor is thinking. Shared by the
 * dashboard tutor card and the full-screen tutor page.
 */
export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((dot) => (
        <motion.span
          key={dot}
          className="size-1.5 rounded-full bg-brand-ink/40"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: dot * 0.14,
          }}
        />
      ))}
    </span>
  );
}
