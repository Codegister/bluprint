import { Meter, enter } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

const TUTOR_KEY = "bluprint.tutorUsed";
const DISMISS_KEY = "bluprint.guideDismissed";
const TUTOR_EVENT = "bluprint:tutor-used";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Not fatal; the guide simply reappears next session.
  }
}

/** Marks the tutor step done. Called by the tutor when an answer is sent. */
export function markTutorUsed() {
  writeFlag(TUTOR_KEY);
  window.dispatchEvent(new Event(TUTOR_EVENT));
}

/**
 * The first-run guide.
 *
 * It names the four moves that make Bluprint work — courses, material, the
 * tutor, a timetable — in the order they build on each other, and it marks them
 * off as they are done. It disappears once all four are complete, so it never
 * becomes another panel to dismiss.
 */
export function GettingStarted({
  onAddMaterial,
  onExploreTutor,
}: {
  onAddMaterial: () => void;
  onExploreTutor: () => void;
}) {
  const courses = useQuery(api.courses.listMine);
  const sets = useQuery(api.studySets.listMine);
  const plan = useQuery(api.timetable.getMine);
  const [tutorUsed, setTutorUsed] = useState(() => readFlag(TUTOR_KEY));
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISS_KEY));

  // Ticking the tutor step live, so asking a question here visibly completes it.
  useEffect(() => {
    const onUsed = () => setTutorUsed(true);
    window.addEventListener(TUTOR_EVENT, onUsed);
    return () => window.removeEventListener(TUTOR_EVENT, onUsed);
  }, []);

  if (dismissed) return null;
  if (courses === undefined || sets === undefined || plan === undefined) {
    return null;
  }

  const steps = [
    {
      title: "Set up your courses",
      body: "Pick your subjects so every topic has a pathway.",
      done: courses.length > 0,
      action: courses.length > 0 ? (
        <Link to="/courses" className="font-semibold text-brand-ink underline-offset-2 hover:underline">
          Open
        </Link>
      ) : (
        <Link to="/courses/new" className="font-semibold text-brand-ink underline-offset-2 hover:underline">
          Choose courses
        </Link>
      ),
    },
    {
      title: "Build a study set",
      body: "Add photos or paste notes; Bluprint writes the cards.",
      done: sets.length > 0,
      action: (
        <button
          type="button"
          onClick={onAddMaterial}
          className="font-semibold text-brand-ink underline-offset-2 hover:underline"
        >
          Add material
        </button>
      ),
    },
    {
      title: "Explore the tutor",
      body: "Ask about a course, a set or a card you keep missing.",
      done: tutorUsed,
      action: (
        <button
          type="button"
          onClick={onExploreTutor}
          className="font-semibold text-brand-ink underline-offset-2 hover:underline"
        >
          Ask a question
        </button>
      ),
    },
    {
      title: "Plan your week",
      body: "Turn your topics into a timetable that ends at your exam.",
      done: plan !== null,
      action: (
        <Link
          to="/timetable/new"
          className="font-semibold text-brand-ink underline-offset-2 hover:underline"
        >
          Build timetable
        </Link>
      ),
    },
  ];

  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  // The first unfinished step is the one to do now, and looking like it.
  const nextIndex = steps.findIndex((step) => !step.done);

  return (
    <motion.section
      aria-labelledby="getting-started-heading"
      className="mt-4 rounded-[1.6rem] border border-border bg-card p-4 sm:p-5"
      {...enter(0.08, 10)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mono-label text-chrome-7">Getting started</p>
          <h2
            id="getting-started-heading"
            className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink"
          >
            Four steps to a working study loop
          </h2>
        </div>
        <span className="rounded-full bg-brand-panel px-2.5 py-1 text-[0.7rem] font-semibold tabular-nums text-brand-ink/70">
          {done} of {steps.length} done
        </span>
      </div>

      <Meter
        value={(done / steps.length) * 100}
        className="mt-3 h-1.5 max-w-[240px] bg-brand-panel"
        barClassName="bg-brand-ink/70"
        label="Getting started progress"
      />

      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li
            key={step.title}
            aria-current={index === nextIndex ? "step" : undefined}
            className={cn(
              "flex items-start gap-2.5 rounded-2xl px-2 py-2 transition-colors hover:bg-brand-panel/60",
              index === nextIndex && "bg-brand-panel/70 ring-1 ring-border",
            )}
          >
            <span
              className={
                step.done
                  ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gizmo-mint text-brand-ink"
                  : "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-brand-ink/35"
              }
              aria-hidden
            >
              {step.done ? (
                <Check className="size-3" />
              ) : (
                <span className="text-[0.6rem] font-bold tabular-nums">
                  {index + 1}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={
                  step.done
                    ? "text-[0.84rem] font-semibold text-brand-ink/50 line-through"
                    : "text-[0.84rem] font-semibold text-brand-ink"
                }
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-[0.74rem] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
            <span className="shrink-0 self-center text-[0.76rem]">
              {step.action}
            </span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => {
          writeFlag(DISMISS_KEY);
          setDismissed(true);
        }}
        className="mt-2 text-[0.72rem] font-medium text-muted-foreground underline-offset-2 hover:text-brand-ink hover:underline"
      >
        Hide this guide
      </button>
    </motion.section>
  );
}
