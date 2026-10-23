import { Brand } from "@/components/Brand";
import { Pip } from "@/components/Pip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  FileText,
  KeyRound,
  Layers,
  ListChecks,
  PenLine,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-brand-ink/15 bg-brand-lime/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

function HeroCard() {
  const [flipped, setFlipped] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[460px] pb-20 lg:pb-10"
    >
      <div className="absolute -inset-4 rotate-3 rounded-[38px] border-2 border-brand-ink/100 bg-brand-mint" />
      <div className="absolute -top-7 right-3 z-20 rotate-3 rounded-full border-2 border-brand-ink bg-brand-lime px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-ink">
        Summary ready
      </div>

      <div className="relative rounded-[30px] border-2 border-brand-ink bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-ink/40">
              Biology · Cell structure
            </p>
            <p className="mt-0.5 font-display text-sm font-semibold text-brand-ink">
              Flashcard 3 of 10
            </p>
          </div>
          <span className="rounded-full bg-brand-peach px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-ink">
            Recall
          </span>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-label="Flip the sample flashcard"
          className="flip-scene block w-full text-left"
        >
          <div
            className={cn(
              "flip-inner relative h-[236px] transition-transform duration-500 sm:h-[252px]",
              flipped && "[transform:rotateY(180deg)]",
            )}
          >
            <div className="flip-face absolute inset-0 flex flex-col justify-between rounded-2xl border border-brand-ink/12 bg-brand-cream p-5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-brand-ink/40">
                <span>Question</span>
                <span className="normal-case tracking-normal">tap to flip</span>
              </div>
              <p className="font-display text-[1.45rem] font-semibold leading-snug text-brand-ink sm:text-[1.6rem]">
                Why does the mitochondrion have folded inner membranes?
              </p>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-brand-ink/50">
                <Layers className="size-3.5" /> Active recall · Unit 2
              </div>
            </div>
            <div className="flip-face flip-back absolute inset-0 flex flex-col justify-between rounded-2xl border border-brand-ink/12 bg-brand-mint p-5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-brand-ink/50">
                <span>Answer</span>
                <span className="normal-case tracking-normal">tap to flip</span>
              </div>
              <p className="font-display text-[1.35rem] font-semibold leading-snug text-brand-ink sm:text-[1.45rem]">
                Folds called cristae increase the surface area for the electron transport
                chain, so more ATP is produced.
              </p>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-brand-ink">
                <Check className="size-3" /> 1 mark · cristae / surface area
              </span>
            </div>
          </div>
        </button>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index < 2 ? "w-4 bg-brand-mint" : index === 2 ? "w-5 bg-brand-pink" : "w-1.5 bg-brand-ink/15",
              )}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="flex h-10 items-center justify-center rounded-xl border border-brand-ink/15 bg-white text-xs font-bold text-brand-ink/60">
            Again
          </div>
          <div className="flex h-10 items-center justify-center rounded-xl bg-brand-ink text-xs font-bold text-brand-cream">
            Got it
          </div>
        </div>
      </div>

      <div className="absolute -bottom-1 -left-3 z-20 flex items-end sm:-left-10">
        <Pip size={122} className="w-[92px] sm:w-[122px] animate-pip-float" />
        <div className="mb-12 ml-1 rotate-3 rounded-2xl rounded-bl-sm border-2 border-brand-ink bg-white px-3 py-2 text-[10px] font-bold leading-tight text-brand-ink sm:mb-16">
          I read the photos
          <br />
          so you don't have to.
        </div>
      </div>

      <div className="absolute -right-2 bottom-7 z-20 flex rotate-[-3deg] items-center gap-2 rounded-full border-2 border-brand-ink bg-brand-sky px-3 py-2 text-[11px] font-bold text-brand-ink sm:-right-6">
        <PenLine className="size-3.5" /> AI marked · 8 / 10
      </div>
    </motion.div>
  );
}

function FeatureTile({
  className,
  icon,
  title,
  copy,
  children,
}: {
  className?: string;
  icon: ReactNode;
  title: string;
  copy: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[26px] border border-brand-ink/12 p-5 transition-transform duration-300 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold leading-tight text-brand-ink">{title}</h3>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-ink/15 bg-white/60 text-brand-ink [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-brand-ink/65">{copy}</p>
      {children ? <div className="mt-4 flex-1">{children}</div> : null}
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const startHref = isAuthenticated ? "/dashboard" : "/auth";
  const startLabel = isAuthenticated ? "Open my sets" : "Start studying free";

  return (
    <div className="min-h-screen bg-brand-cream text-brand-ink">
      <header className="sticky top-0 z-40 border-b border-brand-ink/10 bg-brand-cream/85 backdrop-blur">
        <div className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-brand-ink/60 md:flex">
            <a href="#features" className="transition-colors hover:text-brand-ink">
              Why Pipnote
            </a>
            <a href="#how" className="transition-colors hover:text-brand-ink">
              How it works
            </a>
            <a href="#faq" className="transition-colors hover:text-brand-ink">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <Button
                asChild
                variant="ghost"
                className="hidden rounded-full font-semibold text-brand-ink hover:bg-brand-ink/5 sm:inline-flex"
              >
                <Link to="/auth?returnTo=/dashboard">Sign in</Link>
              </Button>
            )}
            <Button
              asChild
              className="h-10 rounded-full border-2 border-brand-ink bg-brand-ink px-4 text-[13px] font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
            >
              <Link to={startHref}>
                {isAuthenticated ? "Open my sets" : "Start free"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 paper-dots opacity-70 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
        <div className="pointer-events-none absolute -left-24 top-24 size-72 rounded-full bg-brand-mint/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-56 size-72 rounded-full bg-brand-peach/40 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-28 lg:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <Eyebrow>
              <Sparkles className="size-3.5" />
              Built for the night before
            </Eyebrow>

            <h1 className="display-tight mt-5 text-[2.85rem] font-bold leading-[0.98] sm:text-[4rem] lg:text-[4.5rem]">
              Your notes,
              <br />
              turned into{" "}
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute inset-x-0 bottom-1.5 -z-0 h-[38%] -rotate-1 bg-brand-lime" />
                <span className="relative z-10">knowing.</span>
              </span>
            </h1>

            <p className="mt-5 max-w-[30rem] text-[15px] leading-relaxed text-brand-ink/65 sm:text-base">
              Snap photos or a video of your notes — or just paste them in. Pipnote builds
              the summary, flashcards, quiz and exam-style questions you can actually be
              marked on.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full border-2 border-brand-ink bg-brand-pink px-6 font-bold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream"
              >
                <Link to={startHref}>
                  {startLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-brand-ink/20 bg-transparent px-6 font-semibold text-brand-ink hover:bg-white"
              >
                <a href="#how">See how it works</a>
              </Button>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-semibold text-brand-ink/55">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-ink" /> Separate accounts
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-ink" /> Sets saved between sessions
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-ink" /> Powered by NVIDIA
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              {[
                { icon: <Camera className="size-3.5" />, label: "Photos" },
                { icon: <Video className="size-3.5" />, label: "Video frames" },
                { icon: <FileText className="size-3.5" />, label: "Pasted text" },
              ].map((source) => (
                <span
                  key={source.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-ink/12 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-brand-ink/65"
                >
                  {source.icon}
                  {source.label}
                </span>
              ))}
            </div>
          </motion.div>

          <HeroCard />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-brand-ink/10 bg-white/45">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <Eyebrow className="bg-brand-mint/70">One upload, four ways to revise</Eyebrow>
            <h2 className="display-tight mt-4 text-3xl font-bold sm:text-[2.6rem]">
              Pip does the boring part.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-brand-ink/60">
              Upload once. Get a focused summary, a deck of cards, a quiz and written exam
              practice — all built from the material you actually gave it.
            </p>
          </Reveal>

          <div className="mt-9 grid gap-4 md:grid-cols-6">
            <Reveal className="md:col-span-4" delay={0.02}>
              <FeatureTile
                className="h-full bg-brand-mint"
                icon={<BookOpen />}
                title="A summary that gets to the point"
                copy="The overview, the points worth remembering and the angles most likely to come up."
              >
                <div className="rounded-2xl border border-brand-ink/10 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-ink/45">
                    <Sparkles className="size-3" /> Overview
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="h-2 w-[92%] rounded-full bg-brand-ink/20" />
                    <div className="h-2 w-[80%] rounded-full bg-brand-ink/15" />
                    <div className="h-2 w-[62%] rounded-full bg-brand-ink/10" />
                  </div>
                  <div className="mt-4 space-y-2">
                    {["Cristae increase surface area", "Glycolysis happens in the cytoplasm", "ATP synthase uses a proton gradient"].map(
                      (point) => (
                        <div key={point} className="flex items-start gap-2 text-[11px] font-medium text-brand-ink/65">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-pink-deep" />
                          {point}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </FeatureTile>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.06}>
              <FeatureTile
                className="h-full bg-brand-pink"
                icon={<Layers />}
                title="Flashcards built for recall"
                copy="Ten self-contained cards per set, with a review flow that remembers what you've mastered."
              >
                <div className="relative h-[104px]">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="absolute inset-x-0 rounded-xl border border-brand-ink/15 bg-white/80 p-3"
                      style={{
                        top: `${index * 12}px`,
                        transform: `rotate(${index * 2 - 2}deg)`,
                        zIndex: 3 - index,
                      }}
                    >
                      <div className="h-1.5 w-2/3 rounded-full bg-brand-ink/20" />
                      <div className="mt-2 h-1.5 w-full rounded-full bg-brand-ink/10" />
                      <div className="mt-1.5 h-1.5 w-4/5 rounded-full bg-brand-ink/10" />
                    </div>
                  ))}
                </div>
              </FeatureTile>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.02}>
              <FeatureTile
                className="h-full bg-brand-lime"
                icon={<ListChecks />}
                title="Quizzes with explanations"
                copy="Five multiple-choice questions per set. Every answer gets a short reason, not just a tick."
              >
                <div className="space-y-1.5 rounded-xl border border-brand-ink/10 bg-white/65 p-3">
                  <p className="text-[11px] font-bold text-brand-ink">
                    Where is ATP synthase found?
                  </p>
                  {["Inner mitochondrial membrane", "Cytoplasm", "Nucleus", "Ribosome"].map(
                    (option, index) => (
                      <div
                        key={option}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2 py-1 text-[10px] font-medium",
                          index === 0
                            ? "bg-brand-mint text-brand-ink"
                            : "text-brand-ink/50",
                        )}
                      >
                        {option}
                        {index === 0 && <Check className="size-3" />}
                      </div>
                    ),
                  )}
                </div>
              </FeatureTile>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.06}>
              <FeatureTile
                className="h-full bg-brand-sky"
                icon={<PenLine />}
                title="Exam answers, AI-marked"
                copy="Write a real answer. Pip marks it against a guide and shows what earned marks."
              >
                <div className="rounded-xl border border-brand-ink/10 bg-white/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/45">
                      Question 2 · 10 marks
                    </span>
                    <span className="rounded-full bg-brand-lime px-2 py-0.5 font-display text-xs font-bold text-brand-ink">
                      7 / 10
                    </span>
                  </div>
                  <p className="mt-2 text-[10.5px] leading-snug text-brand-ink/60">
                    Strong on structure. Add the role of the proton gradient for the final
                    marks.
                  </p>
                </div>
              </FeatureTile>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.1}>
              <FeatureTile
                className="h-full bg-white"
                icon={<ShieldCheck />}
                title="Saved between sessions"
                copy="Close the tab, come back next week. Your sets and progress wait for you."
              >
                <div className="rounded-xl border border-brand-ink/10 bg-brand-cream/80 p-3">
                  {[
                    ["Cell biology", "10 cards"],
                    ["Organic chemistry", "8 cards"],
                    ["Statistics", "12 cards"],
                  ].map(([title, meta]) => (
                    <div
                      key={title}
                      className="flex items-center justify-between border-b border-brand-ink/10 py-1.5 text-[10.5px] last:border-0"
                    >
                      <span className="font-semibold text-brand-ink/75">{title}</span>
                      <span className="text-brand-ink/40">{meta}</span>
                    </div>
                  ))}
                </div>
              </FeatureTile>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative overflow-hidden bg-brand-ink text-brand-cream">
        <div className="pointer-events-none absolute -left-20 top-10 size-72 rounded-full bg-brand-pink/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 size-80 rounded-full bg-brand-mint/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <Eyebrow className="border-brand-cream/20 bg-brand-lime text-brand-ink">
              Three steps, one minute
            </Eyebrow>
            <h2 className="display-tight mt-4 text-3xl font-bold sm:text-[2.6rem]">
              From camera roll to recall.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-brand-cream/60">
              No folder admin. No blank-page panic. Just the material you already have,
              turned into something you can practise.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Snap it",
                copy: "Upload photos of your notes, a video of the lecture, or paste the text straight in.",
                tint: "bg-brand-peach",
                icon: <Camera className="size-5" />,
              },
              {
                step: "02",
                title: "Pip builds",
                copy: "Pip reads the material and writes a summary, ten flashcards, five quiz questions and exam practice.",
                tint: "bg-brand-mint",
                icon: <Sparkles className="size-5" />,
              },
              {
                step: "03",
                title: "You recall",
                copy: "Flip cards, take the quiz, then write exam answers and get marked with feedback.",
                tint: "bg-brand-sky",
                icon: <PenLine className="size-5" />,
              },
            ].map((step, index) => (
              <Reveal key={step.step} delay={index * 0.06}>
                <div className="relative h-full rounded-[26px] border border-brand-cream/15 bg-brand-cream/[0.06] p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[11px] font-bold tracking-[0.2em] text-brand-cream/35">
                      STEP {step.step}
                    </span>
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-xl border border-brand-ink/10 text-brand-ink",
                        step.tint,
                      )}
                    >
                      {step.icon}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-brand-cream/60">
                    {step.copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-semibold text-brand-cream/50">
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-brand-lime" /> Your NVIDIA key stays on the
              server
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand-lime" /> Each account has private sets
            </span>
          </Reveal>
        </div>
      </section>

      {/* Meet Pip */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div className="relative mx-auto w-full max-w-[380px]">
              <div className="paper-dots relative flex aspect-square items-center justify-center rounded-[44px] border-2 border-brand-ink bg-brand-lime">
                <Pip size={260} className="w-[72%] animate-pip-float" cap />
                <span className="absolute -top-4 left-6 rotate-[-6deg] rounded-full border-2 border-brand-ink bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                  Pip · study sidekick
                </span>
                <span className="absolute -bottom-4 right-6 rotate-3 rounded-full border-2 border-brand-ink bg-brand-pink px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                  Reads handwriting
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <Eyebrow className="bg-brand-pink/40">Meet your study sidekick</Eyebrow>
            <h2 className="display-tight mt-4 text-3xl font-bold sm:text-[2.6rem]">
              Pip is the friend who actually made notes.
            </h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-brand-ink/60">
              Every set is built only from your material — no internet rabbit holes, no
              invented facts. Pip keeps the wording close to your course so revision feels
              familiar.
            </p>

            <div className="mt-6 space-y-3">
              {[
                {
                  icon: <Camera className="size-4" />,
                  title: "Photos and video frames",
                  copy: "Pip transcribes the text it can see before it starts writing.",
                },
                {
                  icon: <PenLine className="size-4" />,
                  title: "Marks like an examiner",
                  copy: "Exam answers are scored against a marking guide, with specific feedback.",
                },
                {
                  icon: <ListChecks className="size-4" />,
                  title: "Tracks what you've mastered",
                  copy: "Cards you mark as known count toward the progress on your set.",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-brand-ink/12 bg-brand-mint text-brand-ink">
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-brand-ink">{item.title}</p>
                    <p className="text-[12.5px] leading-relaxed text-brand-ink/55">
                      {item.copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              asChild
              className="mt-7 h-11 rounded-full border-2 border-brand-ink bg-brand-ink px-5 font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
            >
              <Link to={startHref}>
                {isAuthenticated ? "Back to my sets" : "Make my first set"}
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-brand-ink/10 bg-white/45">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.75fr_1.25fr]">
          <Reveal>
            <Eyebrow className="bg-brand-peach/70">Good to know</Eyebrow>
            <h2 className="display-tight mt-4 text-3xl font-bold sm:text-[2.3rem]">
              Small questions, straight answers.
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-brand-ink/55">
              Built to run for a handful of friends with one shared NVIDIA key.
            </p>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-brand-ink/12 bg-brand-cream p-3">
              <Pip size={52} />
              <p className="text-[12px] font-semibold leading-snug text-brand-ink/65">
                Still stuck? Ask the friend who set it up. That's usually me.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "What can I upload?",
                  a: "JPG/PNG photos of printed or handwritten notes, a video (Pipnote samples six frames from it to read the notes), or text you paste directly. Each study set is generated from one upload at a time.",
                },
                {
                  q: "Do my friends share my study sets?",
                  a: "No. Everyone signs in with their own email code, and every set is tied to that account. Your notes, cards and scores are only visible to you.",
                },
                {
                  q: "Where is the NVIDIA key stored?",
                  a: "The app reads NVIDIA_API_KEY from the deployment environment. If that isn't set, the AI setup screen can verify and store a key in a server-only Convex table. It is never printed or sent to the browser.",
                },
                {
                  q: "What happens when NVIDIA is rate-limited?",
                  a: "Pipnote retries briefly and then shows a clear message on the set, with a Retry button. Nothing is lost — your extracted notes stay saved.",
                },
                {
                  q: "Does it work on my phone?",
                  a: "Yes. The layout collapses to a mobile header and a slide-out menu, and you can add it to your home screen from the browser menu.",
                },
              ].map((item) => (
                <AccordionItem
                  key={item.q}
                  value={item.q}
                  className="border-brand-ink/10"
                >
                  <AccordionTrigger className="py-4 text-left font-display text-[15px] font-semibold text-brand-ink hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-xl pb-5 text-[13px] leading-relaxed text-brand-ink/60">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] border-2 border-brand-ink bg-brand-pink px-6 py-10 sm:px-10 sm:py-14">
            <div className="pointer-events-none absolute inset-0 paper-dots opacity-30" />
            <div className="relative max-w-2xl">
              <span className="inline-flex rounded-full border border-brand-ink/15 bg-white/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                Ready when you are
              </span>
              <h2 className="display-tight mt-4 text-3xl font-bold sm:text-[2.7rem]">
                Your notes are already good. Make them stick.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-brand-ink/70">
                Upload one page and see what Pip builds. Your sets stay saved, your friends
                get their own accounts, and your key never leaves the server.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-6 h-12 rounded-full border-2 border-brand-ink bg-brand-ink px-6 font-bold text-brand-cream hover:bg-brand-cream hover:text-brand-ink"
              >
                <Link to={startHref}>
                  {startLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="pointer-events-none absolute -bottom-12 -right-6 hidden sm:block lg:right-8">
              <Pip size={210} className="rotate-3" cap />
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-brand-ink/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden h-4 w-px bg-brand-ink/15 sm:block" />
            <p className="hidden text-[11px] text-brand-ink/45 sm:block">
              Turn notes into knowing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-semibold text-brand-ink/50">
            <a href="#features" className="hover:text-brand-ink">
              Features
            </a>
            <a href="#how" className="hover:text-brand-ink">
              How it works
            </a>
            <a href="#faq" className="hover:text-brand-ink">
              FAQ
            </a>
            <Link to={startHref} className="hover:text-brand-ink">
              {isAuthenticated ? "My study sets" : "Sign in"}
            </Link>
          </div>
          <p className="text-[11px] text-brand-ink/35">
            Made for friends who cram together.
          </p>
        </div>
      </footer>
    </div>
  );
}
