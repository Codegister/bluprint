import { Brand } from "@/components/Brand";
import { ChromeBackdrop } from "@/components/ChromeBackdrop";
import { InkInWater } from "@/components/InkInWater";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DeckGlyph, Mascot } from "@/components/Mascot";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  EASE,
  Floating,
  Meter,
  Reveal,
  Stagger,
  StaggerItem,
  enter,
  reveal,
} from "@/components/motion/Motion";
import { cn } from "@/lib/utils";
import { ArrowRight, Camera, Sparkles } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

/**
 * A working card in the hero preview. It reuses the same question/answer shape
 * as the real flashcard deck, so the preview shows the product rather than a
 * picture of it.
 */
function HeroPreview() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="gizmo-card p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Mascot size={92} />
        <div>
          <p className="text-[0.9rem] text-muted-foreground">What shall we</p>
          <p className="font-display text-[2rem] font-extrabold leading-none tracking-[-0.04em] text-brand-ink">
            Study?
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-white p-4">
        <p className="text-[0.95rem] text-muted-foreground">Paste notes, or add photos…</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[0.78rem] font-medium text-muted-foreground">
            Cell biology, page 42
          </span>
          <span className="rounded-full border border-brand-ink/40 bg-gizmo-lime px-4 py-2 text-[0.82rem] font-semibold text-brand-ink shadow-[0_2px_0_rgba(28,26,20,0.16)]">
            Generate
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        className="mt-3 block w-full rounded-3xl border border-border bg-brand-panel/60 p-4 text-left transition-colors hover:border-brand-pink/40"
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.72rem] font-semibold text-muted-foreground">
            Card 3 of 10
          </span>
          <span className="text-[0.72rem] font-semibold text-chrome-7">Biology</span>
        </div>
        <p className="mt-3 font-display text-[1.05rem] font-semibold leading-snug text-brand-ink">
          Why does the mitochondrion have folded inner membranes?
        </p>
        <motion.div layout className="mt-3 min-h-[44px]">
          <motion.p
            key={revealed ? "answer" : "prompt"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className={
              revealed
                ? "text-[0.86rem] leading-relaxed text-brand-ink/75"
                : "text-[0.82rem] text-muted-foreground"
            }
          >
            {revealed
              ? "Cristae increase the surface area for the electron transport chain, so more ATP is produced."
              : "Tap to reveal the answer"}
          </motion.p>
        </motion.div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[0.75rem] font-semibold">
          <span className="text-muted-foreground">
            {revealed ? "Self-assessed" : "Active recall"}
          </span>
          <span className="text-chrome-7">
            {revealed ? "Hide answer" : "Reveal answer"}
          </span>
        </div>
      </button>

      <p className="mt-3 text-center text-[0.78rem] text-muted-foreground">
        Built from photos, screen recordings or pasted text
      </p>
    </div>
  );
}

/** A small card that floats around the hero preview. */
function HeroChip({
  className,
  delay = 0,
  children,
}: {
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <div className={cn("absolute z-20", className)}>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE, delay }}
      >
        <Floating distance={6} duration={6.5 + delay} delay={delay} rotate={-1.5}>
          <div className="rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-[0_2px_0_rgba(28,26,20,0.06),0_18px_34px_-26px_rgba(60,50,20,0.5)]">
            {children}
          </div>
        </Floating>
      </motion.div>
    </div>
  );
}

/**
 * The hero composition: the real interactive preview, a slowly rotating dashed
 * orbit, and two small cards drifting around it. Each layer moves at its own
 * speed on scroll, which is what gives the page depth without any 3D assets.
 */
function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const lift = useTransform(scrollYProgress, [0, 1], [16, -22]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[470px] lg:max-w-none">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.svg
            viewBox="0 0 200 200"
            className="size-[390px] text-brand-ink/20 sm:size-[430px]"
            animate={{ rotate: 360 }}
            transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx="100"
              cy="100"
              r="94"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.7"
              strokeDasharray="2 8"
            />
            <circle cx="100" cy="6" r="2.6" fill="#1C1A14" />
            <circle cx="194" cy="100" r="1.8" fill="#8FAE18" />
          </motion.svg>
        </div>
      </div>

      <motion.div style={{ y: lift }} className="relative">
        {/* A lilac sheet peeking out behind the real preview: the stacked-card
            look the Gizmo reels use, made from a single offset div. */}
        <div
          aria-hidden
          className="absolute inset-x-5 -top-3 bottom-3 -z-10 rotate-[-2.5deg] rounded-[2rem] border border-brand-ink/10 bg-gizmo-lilac/45"
        />
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, ease: EASE, delay: 0.15 }}
        >
          <HeroPreview />
        </motion.div>
      </motion.div>

      <HeroChip className="-left-8 top-28 hidden lg:block" delay={0.55}>
        <div className="flex items-center gap-2">
          <span className="pulse-ring size-2 rounded-full bg-brand-pink-deep text-brand-pink-deep" />
          <p className="text-[0.72rem] font-semibold text-brand-ink">10 cards ready</p>
        </div>
        <p className="mt-0.5 text-[0.66rem] text-muted-foreground">From one page of notes</p>
      </HeroChip>

      <HeroChip className="-right-6 bottom-24 hidden sm:block" delay={0.75}>
        <div className="flex w-[148px] items-center justify-between gap-3">
          <p className="text-[0.68rem] font-semibold text-brand-ink">Exam marked</p>
          <p className="text-[0.68rem] font-bold text-brand-ink">7/10</p>
        </div>
        <Meter
          value={70}
          className="mt-1.5 h-1 w-[148px] bg-[#EFEAE0]"
          barClassName="bg-brand-pink-deep"
          delay={1.1}
          label="Sample exam score"
        />
      </HeroChip>

      <motion.div
        aria-hidden
        className="absolute -bottom-7 left-6 hidden items-center gap-1.5 sm:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <span className="text-[0.68rem] font-medium text-brand-ink/40">
          Built from your own notes
        </span>
        <motion.span
          className="h-px w-10 bg-brand-ink/20"
          animate={{ scaleX: [0.4, 1, 0.4], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: 0 }}
        />
      </motion.div>
    </div>
  );
}

/** One of the four outputs. The label replaces an icon so the card stays calm. */
function OutputCard({
  label,
  labelClass,
  title,
  copy,
  children,
}: {
  label: string;
  labelClass: string;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <div className="lift hover-sheen flex h-full flex-col rounded-3xl border border-border bg-card p-5 sm:p-6">
      <p className={cn("mono-label", labelClass)}>{label}</p>
      <h3 className="mt-2 font-display text-[1.15rem] font-semibold text-brand-ink">
        {title}
      </h3>
      <p className="mt-1 text-[0.88rem] leading-relaxed text-muted-foreground">{copy}</p>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const startHref = isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard";
  const startLabel = isAuthenticated ? "Open dashboard" : "Start a study set";
  // Reading progress drawn along the bottom edge of the sticky header.
  const { scrollYProgress } = useScroll();

  return (
    <div className="min-h-screen text-brand-ink">
      {/* One fixed paper wash behind the whole page, so hero, gaps and
          transparent sections all share the same cream desk. */}
      <ChromeBackdrop intensity={0.85} />
      <header className="chrome-bar sticky top-0 z-50 border-b">
        <motion.div
          aria-hidden
          className="chrome-progress absolute inset-x-0 bottom-0 h-[2px] origin-left"
          style={{ scaleX: scrollYProgress }}
        />
        <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />

          <nav className="hidden items-center gap-5 text-[0.9rem] font-medium text-muted-foreground md:flex lg:gap-7">
            <a href="#pipeline" className="transition-colors hover:text-brand-ink">
              How it works
            </a>
            <a href="#outputs" className="transition-colors hover:text-brand-ink">
              What you get
            </a>
            <a href="#workspace" className="transition-colors hover:text-brand-ink">
              Your workspace
            </a>
            <a href="#questions" className="transition-colors hover:text-brand-ink">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!isAuthenticated && (
              <Link
                to="/auth?returnTo=/dashboard"
                className="hidden rounded-full px-4 py-2 text-[0.88rem] font-semibold text-brand-ink/70 transition-colors hover:bg-brand-panel hover:text-brand-ink sm:inline-flex"
              >
                Sign in
              </Link>
            )}
            <Button asChild className="group h-10 px-5 text-[0.88rem]">
              <Link to={startHref}>
                {isAuthenticated ? "Dashboard" : "Get started"}
                {/* Dropped on the narrowest phones so the header (and the theme
                    button beside it) never wraps. */}
                <ArrowRight className="hidden size-4 transition-transform duration-300 group-hover:translate-x-1 sm:block" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        {/* A steel band across the hero, layered on the page chrome so it reads
            as a lit panel rather than a colour wash. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gizmo-lime/25 via-transparent to-gizmo-lilac/25"
        />
        {/* Ink dropped into water: pigment plumes drift across the hero behind
            the copy and the preview card. Decorative, so it is silent to
            screen readers and pauses itself when it leaves the viewport. */}
        <InkInWater intensity={1} />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:pb-20">
          <div>
            <motion.div className="flex flex-wrap gap-2" {...enter(0.04)}>
              <span className="sticker -rotate-1 bg-gizmo-lime text-brand-ink transition-transform hover:-rotate-2">
                <Camera className="size-3" aria-hidden /> Photos and video
              </span>
              <span className="sticker rotate-1 bg-gizmo-lilac/60 text-brand-ink transition-transform hover:rotate-2">
                <Sparkles className="size-3" aria-hidden /> Pasted notes
              </span>
            </motion.div>

            <motion.h1
              className="mt-5 max-w-[34rem] font-display text-[2.9rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-brand-ink sm:text-[3.7rem] lg:text-[4.1rem]"
              {...enter(0.12, 24)}
            >
              A page of notes becomes a{" "}
              <span className="highlighter">revision session.</span>
            </motion.h1>

            <motion.p
              className="mt-6 max-w-[33rem] text-[1.02rem] leading-relaxed text-muted-foreground"
              {...enter(0.22)}
            >
              Upload notes, a photo of a textbook page or a short screen recording.
              Bluprint writes a summary, ten flashcards, a multiple-choice quiz and three
              exam-style questions you can answer for marks.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              {...enter(0.32)}
            >
              <Button asChild size="lg" className="group h-12 px-6 text-[0.95rem]">
                <Link to={startHref}>
                  {startLabel}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 bg-card px-6 text-[0.95rem]"
              >
                <a href="#pipeline">See how it works</a>
              </Button>
            </motion.div>

            <motion.p
              className="mt-7 text-[0.82rem] leading-relaxed text-muted-foreground"
              {...enter(0.42)}
            >
              Sign in with an email code, or try a guest session. Your sets, scores and
              progress are stored against your account.
            </motion.p>
          </div>

          <HeroArt />
        </div>
      </section>

      <section id="pipeline" className="scroll-mt-24 border-b border-border bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <motion.h2
              className="max-w-xl text-[1.9rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2.5rem]"
              {...reveal()}
            >
              From upload to marked answer in three steps.
            </motion.h2>
            <motion.p
              className="max-w-sm text-[0.95rem] leading-relaxed text-muted-foreground"
              {...reveal(0.08)}
            >
              One source per set. Everything generated from it stays together, so the
              summary, cards and questions never drift apart.
            </motion.p>
          </div>

          <div className="relative mt-10">
            {/* The rule above the steps draws itself as the section arrives. */}
            <motion.div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px origin-left bg-chrome-5"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 1.5, ease: EASE }}
            />
            <ol className="border-t border-transparent">
            {[
              {
                title: "Add your material",
                copy: "Photograph your notes, record a short video of a slide deck, or paste text. Bluprint reads the images and keeps the extracted text with the set.",
              },
              {
                title: "Bluprint builds the set",
                copy: "A vision model reads the source. A text model writes a short summary, ten flashcards, five quiz questions with explanations, and three written exam questions with a marking guide.",
              },
              {
                title: "Practise and get marked",
                copy: "Flip each card and rate your recall, take the quiz, then answer the written questions. Exam answers are marked against the guide, with the missing points named.",
              },
            ].map((step, index) => (
              <motion.li
                key={step.title}
                className="grid gap-2 border-b border-border py-6 sm:grid-cols-[72px_minmax(0,0.9fr)_minmax(0,1.3fr)] sm:gap-6 sm:py-7"
                {...reveal(index * 0.1)}
              >
                <span className="relative inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-2xl border border-brand-ink/25 bg-gizmo-lime font-display text-[1.1rem] font-semibold leading-none tabular-nums text-brand-ink shadow-[0_2px_0_rgba(28,26,20,0.1)]">
                  {String(index + 1).padStart(2, "0")}
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl border border-brand-ink/20"
                    initial={{ opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1.12 }}
                    viewport={{ once: false, amount: 0.6 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.15 + index * 0.1 }}
                  />
                </span>
                <h3 className="font-display text-[1.12rem] font-semibold text-brand-ink">
                  {step.title}
                </h3>
                <p className="max-w-xl text-[0.92rem] leading-relaxed text-muted-foreground">
                  {step.copy}
                </p>
              </motion.li>
            ))}
            </ol>
          </div>

          <Reveal className="mt-6 flex flex-col gap-3 rounded-2xl bg-brand-panel px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.92rem] font-semibold text-brand-ink">
              Your uploads are private to your account
            </p>
            <p className="text-[0.84rem] text-muted-foreground">
              The NVIDIA key stays on the server. It is never sent to the browser.
            </p>
          </Reveal>
        </div>
      </section>

      <section id="outputs" className="scroll-mt-24 border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2.5rem]">
              One upload, four ways to practise.
            </h2>
            <p className="mt-3 text-[1rem] leading-relaxed text-muted-foreground">
              The summary is for a first pass. The cards, quiz and exam questions are for
              the days after, when recall has to come from you.
            </p>
          </div>

          <Stagger className="mt-9 grid gap-4 sm:grid-cols-2" gap={0.08} inView>
            <StaggerItem className="h-full" scale>
            <OutputCard
              label="Summary"
              labelClass="text-brand-pink-deep"
              title="The argument, in a few lines"
              copy="An overview, the points worth remembering and the angles an examiner is likely to take."
            >
              <div className="rounded-2xl bg-brand-panel/70 p-4">
                <p className="text-[0.7rem] font-semibold text-muted-foreground">Overview</p>
                <p className="mt-1.5 text-[0.86rem] leading-relaxed text-brand-ink/75">
                  Aerobic respiration converts glucose into ATP. Most ATP is produced by
                  oxidative phosphorylation in the mitochondria.
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    "Cristae increase inner-membrane surface area.",
                    "Glycolysis occurs in the cytoplasm.",
                    "The Krebs cycle runs in the mitochondrial matrix.",
                  ].map((point) => (
                    <p
                      key={point}
                      className="flex items-start gap-2 text-[0.82rem] leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-pink/70" />
                      {point}
                    </p>
                  ))}
                </div>
              </div>
            </OutputCard>
            </StaggerItem>

            <StaggerItem className="h-full" scale>
            <OutputCard
              label="Flashcards"
              labelClass="text-brand-violet"
              title="Ten cards, one idea each"
              copy="Reveal the answer, then mark the card known or bring it back into the next session."
            >
              <div className="rounded-2xl bg-brand-panel/70 p-4">
                <div className="flex items-center justify-between text-[0.72rem] font-semibold text-muted-foreground">
                  <span>Card 4 of 10</span>
                  <span className="text-chrome-7">Known</span>
                </div>
                <p className="mt-3 text-[0.92rem] font-semibold leading-relaxed text-brand-ink/85">
                  Where does the Krebs cycle take place?
                </p>
                <p className="mt-2 border-t border-border pt-2 text-[0.84rem] leading-relaxed text-chrome-7">
                  In the mitochondrial matrix.
                </p>
              </div>
            </OutputCard>
            </StaggerItem>

            <StaggerItem className="h-full" scale>
            <OutputCard
              label="Quiz"
              labelClass="text-brand-sky"
              title="Five questions with reasons"
              copy="Multiple choice, with a short explanation for every option so a wrong answer still teaches you something."
            >
              <div className="rounded-2xl bg-brand-panel/70 p-4">
                <p className="text-[0.88rem] font-semibold leading-relaxed text-brand-ink/85">
                  What do cristae increase?
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {["Membrane surface area", "DNA content", "Cell volume"].map(
                    (option, index) => (
                      <div
                        key={option}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3 py-1.5 text-[0.82rem]",
                          index === 0
                            ? "bg-gizmo-lime/60 font-semibold text-brand-ink"
                            : "bg-white text-muted-foreground",
                        )}
                      >
                        {option}
                        {index === 0 && <span className="text-[0.7rem]">Correct</span>}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </OutputCard>
            </StaggerItem>

            <StaggerItem className="h-full" scale>
            <OutputCard
              label="Exam practice"
              labelClass="text-brand-orange"
              title="Written answers, marked"
              copy="Answer in full sentences. Bluprint marks against the guide and shows which points are still missing."
            >
              <div className="rounded-2xl bg-brand-panel/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[0.72rem] font-semibold text-muted-foreground">
                    Question 2, 10 marks
                  </span>
                  <span className="text-[0.8rem] font-semibold text-chrome-8">7 / 10</span>
                </div>
                <Meter
                  value={70}
                  className="mt-2 h-1.5 bg-white"
                  barClassName="bg-brand-pink-deep"
                  label="Sample exam score"
                />
                <p className="mt-2.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                  Strong structure. Add the proton gradient and ATP synthase to reach the
                  final marks.
                </p>
              </div>
            </OutputCard>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      <section id="workspace" className="scroll-mt-24 border-b border-border bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8">
          <div>
            <motion.h2
              className="max-w-lg text-[1.9rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2.4rem]"
              {...reveal()}
            >
              Your saved sets, waiting on the dashboard.
            </motion.h2>
            <motion.p
              className="mt-3 max-w-lg text-[1rem] leading-relaxed text-muted-foreground"
              {...reveal(0.08)}
            >
              Sign in with your own email. Sets, scores and card progress stay with the
              account that made them, so a shared laptop never mixes two people's revision.
            </motion.p>

            <dl className="rise-stagger mt-7 border-t border-border">
              {[
                ["Sets", "The newest set sits at the top of the dashboard."],
                ["Progress", "Known cards, last quiz score and the date you studied."],
                ["Courses", "Pick your exam board and subjects for a topic-by-topic pathway."],
                ["Tutor", "Ask about any course you have set up."],
              ].map(([term, detail]) => (
                <div
                  key={term}
                  className="grid gap-1 border-b border-border py-3.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="text-[0.86rem] font-semibold text-brand-ink">{term}</dt>
                  <dd className="text-[0.86rem] leading-relaxed text-muted-foreground">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <Reveal className="lift rounded-3xl border border-border bg-background p-3" delay={0.1}>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-display text-[0.98rem] font-semibold text-brand-ink">
                Study sets
              </span>
              <span className="text-[0.76rem] font-medium text-muted-foreground">
                3 saved
              </span>
            </div>
            <div className="rise-stagger space-y-1.5">
              {[
                { title: "Cell biology", color: "#1C1A14", meta: "10 cards, 5 quiz" },
                { title: "Organic chemistry", color: "#8FAE18", meta: "10 cards, 5 quiz" },
                { title: "Macroeconomics", color: "#7D5BD6", meta: "10 cards, 5 quiz" },
              ].map((deck) => (
                <div
                  key={deck.title}
                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5"
                >
                  <DeckGlyph className="size-7" color={deck.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9rem] font-semibold text-brand-ink">
                      {deck.title}
                    </p>
                    <p className="text-[0.75rem] text-muted-foreground">{deck.meta}</p>
                  </div>
                  <span className="text-[0.72rem] font-semibold text-chrome-7">Ready</span>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-border bg-white p-4">
              <p className="text-[0.85rem] font-semibold text-brand-ink">
                Model access is handled on the server
              </p>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">
                NVIDIA_API_KEY is read from the server environment and is never exposed to
                the browser.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="questions" className="scroll-mt-24 border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
          <div>
            <motion.h2
              className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2.3rem]"
              {...reveal()}
            >
              Questions before you start.
            </motion.h2>
            <motion.p
              className="mt-3 max-w-xs text-[0.95rem] leading-relaxed text-muted-foreground"
              {...reveal(0.08)}
            >
              Built to run for a handful of friends with one shared NVIDIA key.
            </motion.p>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-white p-4">
              <Mascot size={52} float={false} />
              <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                If a build fails, the set keeps its extracted notes and gives you a retry.
              </p>
            </div>
          </div>

          <Reveal className="w-full" delay={0.1}>
          <Accordion type="single" collapsible className="w-full">
            {[
              {
                q: "What can I upload?",
                a: "JPG or PNG photos of printed or handwritten notes, a video (six frames are sampled in your browser), or text pasted directly. Each set is built from one source upload.",
              },
              {
                q: "Who can see my study sets?",
                a: "Only you. Sign-in uses an email one-time code, and every query checks ownership before returning a set, card, quiz or score.",
              },
              {
                q: "Where does the NVIDIA key live?",
                a: "In the server environment, under NVIDIA_API_KEY. You can supply several keys in that value; Bluprint rotates through them on each request, and no key is ever sent to the browser.",
              },
              {
                q: "What happens when a build fails?",
                a: "The set is marked failed with the model's error. Your extracted notes and uploaded images are kept, and retrying re-runs generation without a new upload.",
              },
              {
                q: "Does it work on a phone?",
                a: "Yes. The workspace collapses to a mobile header and menu, and the app can be installed from your browser's add-to-home-screen action.",
              },
            ].map((item) => (
              <AccordionItem
                key={item.q}
                value={item.q}
                className="border-b border-border py-1 last:border-b-0"
              >
                <AccordionTrigger className="py-4 text-left font-display text-[1rem] font-semibold text-brand-ink hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="max-w-xl pb-4 pr-6 text-[0.88rem] leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <Reveal className="chrome-hero relative overflow-hidden rounded-[2rem] px-6 py-9 sm:px-10 sm:py-11">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-gizmo-lime/30 via-transparent to-gizmo-lilac/25"
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <h2 className="max-w-xl text-[1.9rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2.4rem]">
                Start with the notes you already have.
              </h2>
              <p className="mt-3 max-w-lg text-[0.95rem] leading-relaxed text-brand-ink/65">
                Set up your courses once, or upload a single page and see what comes back.
                Everything stays saved for the next session.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button asChild size="lg" className="group h-12 px-6 text-[0.95rem]">
                  <Link to={startHref}>
                    {startLabel}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 bg-card px-6 text-[0.95rem] text-brand-ink"
                >
                  <Link to="/auth?returnTo=/dashboard">I already have an account</Link>
                </Button>
              </div>
            </div>
            <div className="relative flex justify-center">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <motion.div
                  aria-hidden
                  className="size-[240px] rounded-full border border-dashed border-brand-ink/25"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
                  style={{ borderStyle: "dashed" }}
                />
              </div>
              <Mascot size={190} />
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Brand />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.85rem] font-medium text-muted-foreground">
            <a href="#pipeline" className="hover:text-brand-ink">
              How it works
            </a>
            <a href="#outputs" className="hover:text-brand-ink">
              What you get
            </a>
            <a href="#workspace" className="hover:text-brand-ink">
              Your workspace
            </a>
            <Link to={startHref} className="hover:text-brand-ink">
              {isAuthenticated ? "Dashboard" : "Sign in"}
            </Link>
          </div>
          <p className="text-[0.78rem] text-muted-foreground">Built for a small group</p>
        </div>
      </footer>
    </div>
  );
}
