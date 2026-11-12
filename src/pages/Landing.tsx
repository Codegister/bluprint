import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { readableError } from "@/lib/errors";
import { savePendingNotes } from "@/lib/pendingNotes";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

const MIN_NOTES = 40;
const HOME_DRAFT_KEY = "bluprint:home-draft";

/** The static hero writes this key before React arrives; read it once here. */
function readHomeDraft(): string {
  try {
    return window.sessionStorage.getItem(HOME_DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function clearHomeDraft(): void {
  try {
    window.sessionStorage.removeItem(HOME_DRAFT_KEY);
  } catch {
    // Storage can be unavailable; navigation must still work.
  }
}

/**
 * Public Home. It is the stage: one sentence, one action and real paper
 * surfaces. The pasted notes still make the same trip through pending storage
 * into Auth and the tutor workspace.
 */
export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, signIn } = useAuth();
  const [notes, setNotes] = useState(readHomeDraft);
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState("");

  const heroRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const paperY = useTransform(scrollYProgress, [0, 1], [0, -26]);

  const trimmed = notes.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_NOTES;
  const startHref = isAuthenticated
    ? "/tutor?new=1"
    : `/auth?returnTo=${encodeURIComponent("/tutor?new=1")}`;

  function startFromHero() {
    if (tooShort) return;
    if (trimmed) savePendingNotes(trimmed);
    clearHomeDraft();
    if (isAuthenticated) {
      navigate("/tutor?new=1");
      return;
    }
    navigate(startHref);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startFromHero();
  }

  async function startAsGuest() {
    if (guestBusy) return;
    setGuestBusy(true);
    setGuestError("");
    try {
      if (trimmed.length >= MIN_NOTES) savePendingNotes(trimmed);
      await signIn("anonymous");
      clearHomeDraft();
      navigate("/tutor");
    } catch (error) {
      setGuestError(readableError(error, "Could not start a guest session. Please try again."));
      setGuestBusy(false);
    }
  }

  return (
    <div className="stage-home">
      <header className="home-header">
        <div className="home-wrap home-header-inner">
          <Link to="/" className="home-brand" aria-label="Bluprint home">
            Bluprint<span>.</span>
          </Link>
          <nav className="home-nav" aria-label="Home">
            <a href="#how">How it works</a>
          </nav>
          <div className="home-header-actions">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/tutor" className="home-signin">
                Open workspace
              </Link>
            ) : (
              <Link
                to={`/auth?returnTo=${encodeURIComponent("/tutor")}`}
                className="home-signin"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section ref={heroRef} className="home-wrap home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-kicker">Revision from your notes</p>
            <h1 id="home-title" className="home-title">
              Your handwriting, marked against the scheme.
            </h1>
            <p className="home-lede">
              Bluprint turns a page into flashcards, quiz questions and an exam answer
              marked against the scheme.
            </p>

            <form className="home-build" onSubmit={onSubmit} noValidate>
              <label htmlFor="home-notes" className="home-build-label">
                Build a set from your notes
              </label>
              <div className="home-build-row">
                <textarea
                  id="home-notes"
                  name="notes"
                  rows={2}
                  maxLength={20000}
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    if (guestError) setGuestError("");
                  }}
                  placeholder="Paste a page from your notebook…"
                  aria-describedby="home-notes-hint"
                />
                <button type="submit" className="stage-button" disabled={tooShort}>
                  Build a set
                  <ArrowRight size={18} strokeWidth={1.8} aria-hidden />
                </button>
              </div>
              <p id="home-notes-hint" className="home-build-hint">
                {tooShort
                  ? "Add a sentence or two before building the set."
                  : "Nothing leaves this page until you build."}
              </p>
              {!isAuthenticated && (
                <button
                  type="button"
                  className="home-guest"
                  onClick={startAsGuest}
                  disabled={guestBusy}
                >
                  {guestBusy ? "Starting a guest session…" : "Start a guest session"}
                </button>
              )}
              {guestError && (
                <p className="home-error" role="alert">
                  {guestError}
                </p>
              )}
            </form>
          </div>

          <motion.div
            className="home-paper-field"
            style={reducedMotion ? undefined : { y: paperY }}
            aria-hidden="true"
          >
            <div className="home-paper home-paper-spec">
              <div className="home-paper-spec-meta">
                <span>Specification</span>
                <span>AQA · 3.1.1</span>
              </div>
              <p className="home-paper-spec-copy">
                Cells are the basic unit of living organisms.
              </p>
            </div>

            <div className="home-paper home-paper-cover">
              <div className="home-paper-meta">
                <span>Set 04</span>
                <span>Cell biology</span>
              </div>
              <p className="home-paper-cover-title">Cell structure and transport</p>
              <p className="home-paper-facts">8 cards · 24 quiz · 2 exam</p>
              <div className="home-paper-cover-foot">
                <span>AQA · GCSE</span>
                <strong>7 / 10</strong>
              </div>
            </div>

            <div className="home-paper home-paper-flash">
              <div className="home-paper-meta">
                <span>Flashcard 03</span>
                <span>Cell structure</span>
              </div>
              <p className="home-flash-question">Why does the inner membrane fold?</p>
              <p className="home-flash-answer">
                Cristae increase the surface area for ATP production.
              </p>
              <div className="home-paper-flash-foot">
                <span>Marked against the scheme</span>
                <strong>2 / 2</strong>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="how" className="home-process" aria-labelledby="how-title">
          <div className="home-wrap home-process-grid">
            <div>
              <p className="home-kicker">After the paste</p>
              <h2 id="how-title" className="home-section-title">
                A page becomes a set, and every mark names a gap.
              </h2>
              <ol className="home-steps">
                <li className="home-step">
                  <span className="home-step-index">01</span>
                  <div>
                    <h3 className="home-step-title">Paste one page of your notes.</h3>
                    <p className="home-step-copy">
                      A page is enough. Bluprint keeps the wording and the context.
                    </p>
                  </div>
                </li>
                <li className="home-step">
                  <span className="home-step-index">02</span>
                  <div>
                    <h3 className="home-step-title">Get cards, quiz and an exam answer.</h3>
                    <p className="home-step-copy">
                      Every question stays tied to the page it came from.
                    </p>
                  </div>
                </li>
                <li className="home-step">
                  <span className="home-step-index">03</span>
                  <div>
                    <h3 className="home-step-title">See the gap the mark scheme names.</h3>
                    <p className="home-step-copy">
                      The answer comes back marked, not just corrected.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="home-mark-sheet" aria-label="Example marked answer">
              <div className="home-mark-meta">
                <span>Exam practice</span>
                <span>10 marks</span>
              </div>
              <p className="home-mark-score">7 / 10</p>
              <p className="home-mark-question">
                Explain how the inner membrane is adapted for ATP production.
              </p>
              <p className="home-mark-answer">
                Cristae increase the surface area for ATP synthase.
              </p>
              <p className="home-mark-note">Two marks named. One gap left.</p>
            </div>
          </div>
        </section>

        <section className="home-close" aria-labelledby="close-title">
          <div className="home-wrap home-close-inner">
            <p className="home-kicker">Start with one page</p>
            <h2 id="close-title" className="home-close-title">
              Open a page. Leave with the scheme's gaps named.
            </h2>
            <a href="#home-notes" className="stage-button">
              Build a set from your notes
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden />
            </a>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-wrap home-footer-inner">
          <Link to="/" className="home-brand">
            Bluprint<span>.</span>
          </Link>
          <nav aria-label="Legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/contact">Contact</Link>
          </nav>
          <p>Built for the days after the first read.</p>
        </div>
      </footer>
    </div>
  );
}
