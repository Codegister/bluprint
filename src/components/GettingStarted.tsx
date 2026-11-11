import { enter } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
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
 * The first-run guide, reduced to the one thing to do next.
 *
 * A four-column checklist said the same thing four times and pushed the actual
 * work below the fold. This strip keeps the progress and the next action, then
 * gets out of the way.
 */
export function GettingStarted({
  onExploreTutor,
}: {
  onExploreTutor: () => void;
}) {
  const courses = useQuery(api.courses.listMine);
  const sets = useQuery(api.studySets.listMine);
  const plan = useQuery(api.timetable.getMine);
  const [tutorUsed, setTutorUsed] = useState(() => readFlag(TUTOR_KEY));
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISS_KEY));

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
      action:
        courses.length > 0 ? (
          <Link
            to="/courses"
            className="font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            Open
          </Link>
        ) : (
          <Link
            to="/courses/new"
            className="font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            Choose courses
          </Link>
        ),
    },
    {
      title: "Build a study set",
      body: "Use a course topic, or add photos and notes; Bluprint writes the cards.",
      // An interrupted build created a set but no usable cards. Setup is only
      // complete once the build produced something the student can study.
      done: sets.some((set) => set.cardCount > 0 || set.quizCount > 0 || set.examCount > 0),
      // The page's primary "Add material" button already does this. Keeping a
      // second build link in the strip would split the screen's one action.
      action: null,
    },
    {
      title: "Explore the tutor",
      body: "Ask about a course, a set or a card you keep missing.",
      done: tutorUsed && (courses.length > 0 || sets.length > 0),
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
  const next = steps.find((step) => !step.done);
  if (!next) return null;

  return (
    <motion.section
      aria-labelledby="getting-started-heading"
      className="setup-strip"
      {...enter(0.08, 10)}
    >
      <div className="flex items-center gap-2">
        <p className="mono-label setup-label">Setup</p>
        <span
          className="setup-count"
          title={`${done} of ${steps.length} steps done`}
        >
          {done}/{steps.length}
        </span>
        <span className="setup-dots" aria-hidden>
          {steps.map((step) => (
            <span
              key={step.title}
              className={step.done ? "setup-dot is-done" : "setup-dot"}
            />
          ))}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h2
          id="getting-started-heading"
          className="setup-next"
        >
          Next: {next.title}
        </h2>
        <p className="setup-body">{next.body}</p>
      </div>

      {next.action && (
        <span className="shrink-0 text-[0.76rem]">{next.action}</span>
      )}
      <button
        type="button"
        onClick={() => {
          writeFlag(DISMISS_KEY);
          setDismissed(true);
        }}
        aria-label="Hide setup guide"
        title="Hide setup guide"
        className="setup-dismiss"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </motion.section>
  );
}
