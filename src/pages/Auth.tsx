import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EASE, enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { readableError } from "@/lib/errors";
import { safeReturnTo } from "@/lib/authRedirect";
import { cn } from "@/lib/utils";

import { motion } from "framer-motion";
import { useConvex } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

/** How long the page waits before offering another code. */
const RESEND_SECONDS = 60;

/** The same minimum the server enforces, so the hint never promises a rule. */
const MIN_PASSWORD_LENGTH = 8;

/** Seconds remaining until a timestamp, for the page's own countdown. */
function secondsUntil(at: number | undefined, now: number): number {
  if (!at) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/tutor") {
  return safeReturnTo(returnTo, fallback);
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, user, signIn } = useAuth();
  const navigate = useNavigate();
  const convex = useConvex();
  const [searchParams] = useSearchParams();
  const linkMode = searchParams.get("link") === "1";
  const convertingGuest = linkMode && user?.isAnonymous === true;
  const resolving = authLoading || user === undefined;
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  // The page's four steps. The first visit signs in with an emailed code and
  // then offers a password; every later visit starts at the password, with the
  // code still there for anyone who would rather not use one.
  const [step, setStep] = useState<
    | { kind: "email" }
    | { kind: "password"; email: string }
    | { kind: "code"; email: string }
    | { kind: "newPassword"; email: string }
    | { kind: "reset"; email: string }
  >({ kind: "email" });
  const [otp, setOtp] = useState("");
  const [typedEmail, setTypedEmail] = useState("");
  // The address a code was last sent to, and when. The cooldown belongs to the
  // address, so correcting a typo is never blocked by the previous send.
  const [sentTo, setSentTo] = useState("");
  const [lastSent, setLastSent] = useState<{ email: string; at: number } | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The countdowns run off one clock so every label on the page agrees.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // The server owns the guard: a browser can no longer set, reset or clear an
  // attempt record, and the sign-in page is signed out, so it cannot read one
  // either. This local count only shapes the wording; Convex Auth enforces the
  // real five-tries-per-hour limit on every verification.
  const [failures, setFailures] = useState(0);
  const attemptsLeft = Math.max(0, 5 - failures);
  // Both code screens share the one cooldown: it belongs to the address, and
  // the server counts sign-in and reset codes against the same budget.
  const codeStepEmail =
    step.kind === "code" || step.kind === "reset"
      ? step.email.trim().toLowerCase()
      : "";
  const resendIn =
    lastSent && codeStepEmail && lastSent.email === codeStepEmail
      ? Math.max(
          0,
          Math.ceil((lastSent.at + RESEND_SECONDS * 1000 - now) / 1000),
        )
      : 0;
  const typedResendIn =
    lastSent && lastSent.email === typedEmail.trim().toLowerCase()
      ? Math.max(0, Math.ceil((lastSent.at + RESEND_SECONDS * 1000 - now) / 1000))
      : 0;

  useEffect(() => {
    // A guest who arrived through "Add an email" is authenticated already, but
    // must stay on this screen to verify the new address. A normal signed-in
    // visitor is sent straight on. Only the first step redirects: once the page
    // is mid-flow (choosing the password, say) the student has become signed in
    // by design, and the flow finishes here rather than being cut short.
    if (!resolving && isAuthenticated && !convertingGuest && step.kind === "email") {
      navigate(redirect);
    }
  }, [resolving, isAuthenticated, convertingGuest, navigate, redirect, step.kind]);

  /** Sends a code and records when, so the resend cooldown is honest. */
  const sendCode = async (email: string): Promise<boolean> => {
    const formData = new FormData();
    formData.set("email", email);
    try {
      await signIn("email-otp", formData);
      setSentTo(email);
      setFailures(0);
      setLastSent({ email: email.trim().toLowerCase(), at: Date.now() });
      setStep({ kind: "code", email });
      setError(null);
      return true;
    } catch (signInError) {
      // The provider's own error can name an HTTP status or a mail endpoint.
      // The page shows a readable sentence and logs the rest.
      setError(
        readableError(
          signInError,
          "We couldn't send the code. Check the address and try again in a minute. If it still doesn't arrive, use a guest session.",
        ),
      );
      return false;
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const email = typedEmail.trim();
    // Validate here, not through the browser tooltip: the message has to stay
    // on the page, under the field, where it can be read and corrected.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Enter a valid email address, like you@school.uk.");
      return;
    }
    setIsLoading(true);
    // A returning student who set a password is asked for it instead of being
    // sent another code. Everyone else gets the code, which is what creates the
    // account on a first visit.
    if (await addressHasPassword(email)) {
      // The password account is stored under the lowercased address (the
      // server's profile does that), and Convex Auth's reset code is only
      // accepted for the address it was issued to. Carrying the same form here
      // means a capital letter typed today cannot break a reset later.
      setStep({ kind: "password", email: email.trim().toLowerCase() });
      setIsLoading(false);
      return;
    }
    // The send path enforces the cooldown and the hourly cap on the server. A
    // refused send comes back as the provider's readable error.
    await sendCode(email);
    setIsLoading(false);
  };

  /**
   * What the student reads after a wrong code. The count comes from the server,
   * so it is the same after a reload, and it says plainly when the code has
   * been thrown away rather than inviting another guess.
   */
  /** A wrong code. The real limit is enforced by the server; this is wording. */
  const failureMessage = (left: number): string => {
    if (left <= 0) {
      return "That code didn't work. Request a new code below.";
    }
    return `That code didn't work. ${left} attempt${left === 1 ? "" : "s"} left.`;
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (attemptsLeft === 0) {
      setError("Request a new code below to keep trying.");
      return;
    }

    const formData = new FormData(event.currentTarget);

    setIsLoading(true);
    try {
      await signIn("email-otp", formData);
      // First sign-in on this account: offer the password that makes the next
      // one a single field. Skipping costs nothing, and the code keeps working.
      if (step.kind === "code" && !(await addressHasPassword(step.email))) {
        setStep({ kind: "newPassword", email: step.email });
        setIsLoading(false);
        return;
      }
      navigate(redirect);
    } catch (verifyError) {
      setOtp("");
      // A dropped connection is not a wrong code, and must not spend one of
      // the five tries.
      const message =
        verifyError instanceof Error ? verifyError.message : String(verifyError);
      if (/network|fetch|disconnect|timed? ?out|offline/i.test(message)) {
        setError(
          "We couldn't reach the server. Check your connection and try again — that attempt was not counted.",
        );
        setIsLoading(false);
        return;
      }

      setFailures((count) => count + 1);
      setError(failureMessage(Math.max(0, attemptsLeft - 1)));
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!sentTo || resendIn > 0) return;
    setIsLoading(true);
    // On the reset screen the new code must be a reset code, not a sign-in one.
    const sent =
      step.kind === "reset"
        ? await requestResetCode(sentTo)
        : await sendCode(sentTo);
    setIsLoading(false);
    setOtp("");
    setFailures(0);
    if (sent) {
      toast.success("A new code is on its way.");
    }
  };

  /**
   * Whether this address already has a password, which decides the form the
   * first step shows. A failure is treated as "no password": the emailed code
   * always works, so that is the safe answer.
   */
  const addressHasPassword = async (email: string): Promise<boolean> => {
    try {
      return await convex.query(api.passwordSignIn.hasPassword, { email });
    } catch {
      return false;
    }
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await signIn("password", new FormData(event.currentTarget));
      navigate(redirect);
    } catch (passwordError) {
      setError(
        readableError(
          passwordError,
          "That email and password don't match an account. Check them, or email yourself a code.",
        ),
      );
      setIsLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      // `signUp` is how the provider attaches a password. The address was
      // verified by the code that just signed in, and the server refuses a
      // password for any address that has not been verified.
      await signIn("password", new FormData(event.currentTarget));
      navigate(redirect);
    } catch (passwordError) {
      setError(
        readableError(
          passwordError,
          "We couldn't save that password. You can skip it for now and set one another time.",
        ),
      );
      setIsLoading(false);
    }
  };

  const handleSendCodeInstead = async (email: string) => {
    setError(null);
    setIsLoading(true);
    await sendCode(email);
    setIsLoading(false);
  };

  /**
   * Asks the server to email a password-reset code. This is Convex Auth's own
   * reset flow, so the code is tied to the address on the account and only a
   * correct code can replace the password: forgetting it does not mean losing
   * the account, and nobody else can take it over.
   */
  const requestResetCode = async (email: string): Promise<boolean> => {
    const formData = new FormData();
    formData.set("email", email);
    formData.set("flow", "reset");
    try {
      await signIn("password", formData);
      setSentTo(email);
      setFailures(0);
      setLastSent({ email: email.trim().toLowerCase(), at: Date.now() });
      setOtp("");
      setStep({ kind: "reset", email });
      setError(null);
      return true;
    } catch (resetError) {
      setError(
        readableError(
          resetError,
          "We couldn't send a reset code. Try again in a minute, or email yourself a sign-in code.",
        ),
      );
      return false;
    }
  };

  const handleForgotPassword = async (email: string) => {
    setError(null);
    setIsLoading(true);
    await requestResetCode(email);
    setIsLoading(false);
  };

  const handleResetSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (attemptsLeft === 0) {
      setError("Request a new reset code below to keep trying.");
      return;
    }

    setIsLoading(true);
    try {
      // One call checks the code, replaces the password and signs the student
      // in. The old password stops working the moment the new one is saved.
      await signIn("password", new FormData(event.currentTarget));
      navigate(redirect);
    } catch (resetError) {
      setOtp("");
      // A dropped connection is not a wrong code, and must not spend a try.
      const message =
        resetError instanceof Error ? resetError.message : String(resetError);
      if (/network|fetch|disconnect|timed? ?out|offline/i.test(message)) {
        setError(
          "We couldn't reach the server. Check your connection and try again — that attempt was not counted.",
        );
        setIsLoading(false);
        return;
      }

      setFailures((count) => count + 1);
      setError(
        readableError(
          resetError,
          "That code didn't work. Check it, or request a new one.",
        ),
      );
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (guestError) {
      setError(
        readableError(
          guestError,
          "Could not start a guest session. Try again.",
        ),
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Context panel */}
      <aside className="auth-aside">
        <motion.div className="auth-aside-top" {...enter(0.05)}>
          <Brand />
          <ThemeToggle />
        </motion.div>

        <div className="auth-aside-main">
          <motion.p className="page-kicker" {...enter(0.12)}>
            <span className="page-kicker-dot" aria-hidden />
            Your revision desk
          </motion.p>
          <motion.h1 className="auth-title" {...enter(0.18)}>
            Every page, score and gap,{" "}
            <span className="highlighter">kept together.</span>
          </motion.h1>
          <motion.p className="auth-lede" {...enter(0.26)}>
            One quiet place for the sets you build, the answers you mark and the
            gaps worth returning to.
          </motion.p>

          <motion.div className="auth-stack" aria-hidden {...enter(0.34)}>
            <div className="auth-stack-sheet auth-stack-sheet-back" />
            <div className="auth-stack-sheet auth-stack-sheet-front">
              <div className="auth-stack-meta">
                <span>Flashcard 03</span>
                <span>Cell biology</span>
              </div>
              <p>Why does the inner membrane fold?</p>
              <span className="auth-stack-rule">
                <i />
              </span>
              <div className="auth-stack-foot">
                <span>Recall</span>
                <span>7 / 10 marked</span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.p className="auth-aside-foot" {...enter(0.44)}>
          Private by default · A code, or a password you choose
        </motion.p>
      </aside>

      {/* Form panel */}
      <main className="auth-main">
        <div className="auth-panel">
          <div className="auth-mobile-top">
            <Brand />
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="rounded-full px-3 py-1.5 text-[0.82rem] font-semibold text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
              >
                ← Home
              </Link>
              <ThemeToggle />
            </div>
          </div>

          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
          >
            {/* Each step fades in from its side. Swapping in place (rather than
                waiting for an exit) keeps the card's height honest. */}
            {step.kind === "email" ? (
              <motion.div
                key="sign-in"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <h2 className="text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink">
                  {convertingGuest
                    ? "Add an email to keep your sets"
                    : "Sign in to your workspace"}
                </h2>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                  {convertingGuest
                    ? "We'll email a six-digit code to confirm the address. Your guest sets and progress stay attached to this account."
                    : "If you've set a password, we'll ask for it. Otherwise we'll email you a six-digit code — and if you're new, this same form creates your account."}
                  </p>

                <form onSubmit={handleEmailSubmit} className="mt-6" noValidate>
                  <label
                    htmlFor="email"
                    className="text-[0.82rem] font-semibold text-brand-ink"
                  >
                    Email address
                  </label>
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      placeholder="you@school.uk"
                      type="email"
                      autoComplete="email"
                      value={typedEmail}
                      onChange={(event) => setTypedEmail(event.target.value)}
                      className="auth-input pl-10"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  {error && (
                    <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFF1F3] px-3 py-2.5 text-[0.85rem] text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || typedResendIn > 0}
                    className="auth-submit mt-4 w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : typedResendIn > 0 ? (
                      <>Send another in {typedResendIn}s</>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  {!convertingGuest && (
                    <>
                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[0.8rem] text-muted-foreground">or</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                    className="mx-auto block text-[0.82rem] font-semibold text-brand-ink/70 underline-offset-4 hover:text-brand-ink hover:underline disabled:opacity-50"
                  >
                    Continue as guest
                  </button>
                  <p className="mt-1.5 text-center text-[0.74rem] leading-relaxed text-muted-foreground">
                    Guest sessions stay on this browser.
                  </p>
                    </>
                  )}
                  {convertingGuest && (
                    <p className="mt-3 rounded-2xl bg-brand-panel px-3 py-2 text-[0.74rem] leading-relaxed text-muted-foreground">
                      If this email already has a Bluprint account, you&apos;ll
                      sign into that account. Export guest sets first if you want
                      a separate copy.
                    </p>
                  )}
                </form>
              </motion.div>
            ) : step.kind === "password" ? (
              <motion.div
                key="password"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep({ kind: "email" });
                    setError(null);
                  }}
                  className="mb-4 inline-flex items-center gap-1.5 rounded-full text-[0.85rem] font-semibold text-muted-foreground hover:text-brand-ink"
                >
                  <ArrowLeft className="size-3.5" /> Use a different email
                </button>

                <h2 className="text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink">
                  Welcome back
                </h2>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                  Enter the password for{" "}
                  <span className="font-semibold text-brand-ink">
                    {step.email}
                  </span>
                  .
                </p>

                <form onSubmit={handlePasswordSubmit} className="mt-6" noValidate>
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="flow" value="signIn" />

                  <label
                    htmlFor="password"
                    className="text-[0.82rem] font-semibold text-brand-ink"
                  >
                    Password
                  </label>
                  <div className="relative mt-2">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Your password"
                      className="auth-input pl-10"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  {error && (
                    <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFF1F3] px-3 py-2.5 text-[0.85rem] text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="auth-submit mt-4 w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => void handleSendCodeInstead(step.email)}
                    disabled={isLoading}
                    className="mx-auto mt-4 block text-[0.82rem] font-semibold text-brand-ink/70 underline-offset-4 hover:text-brand-ink hover:underline disabled:opacity-50"
                  >
                    Email me a code instead
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleForgotPassword(step.email)}
                    disabled={isLoading}
                    className="mx-auto mt-2 block text-[0.82rem] font-semibold text-brand-ink/70 underline-offset-4 hover:text-brand-ink hover:underline disabled:opacity-50"
                  >
                    Forgot your password?
                  </button>
                </form>
              </motion.div>
            ) : step.kind === "newPassword" ? (
              <motion.div
                key="new-password"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <h2 className="text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink">
                  Set a password
                </h2>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                  Your email is confirmed. Next time, signing in is one field and
                  one click — or keep using codes, if you'd rather.
                </p>

                <form
                  onSubmit={handleNewPasswordSubmit}
                  className="mt-6"
                  noValidate
                >
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="flow" value="signUp" />

                  <label
                    htmlFor="new-password"
                    className="text-[0.82rem] font-semibold text-brand-ink"
                  >
                    Password
                  </label>
                  <div className="relative mt-2">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      className="auth-input pl-10"
                      disabled={isLoading}
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                  </div>

                  {error && (
                    <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFF1F3] px-3 py-2.5 text-[0.85rem] text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="auth-submit mt-4 w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Save password
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => navigate(redirect)}
                    disabled={isLoading}
                    className="mx-auto mt-4 block text-[0.82rem] font-semibold text-brand-ink/70 underline-offset-4 hover:text-brand-ink hover:underline disabled:opacity-50"
                  >
                    Skip for now
                  </button>
                </form>
              </motion.div>
            ) : step.kind === "reset" ? (
              <motion.div
                key="reset"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep({ kind: "password", email: step.email });
                    setError(null);
                    setOtp("");
                  }}
                  className="mb-4 inline-flex items-center gap-1.5 rounded-full text-[0.85rem] font-semibold text-muted-foreground hover:text-brand-ink"
                >
                  <ArrowLeft className="size-3.5" /> Back
                </button>

                <h2 className="text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink">
                  Choose a new password
                </h2>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                  Enter the six-digit code sent to{" "}
                  <span className="font-semibold text-brand-ink">
                    {step.email}
                  </span>{" "}
                  and pick the password you want. Saving it signs you in, and the
                  old password stops working.
                </p>

                <form onSubmit={handleResetSubmit} className="mt-6">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />
                  <input
                    type="hidden"
                    name="flow"
                    value="reset-verification"
                  />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (event.target as HTMLElement).closest("form");
                          form?.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup className="gap-1.5">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="size-11 rounded-xl border border-border bg-white text-lg font-semibold text-brand-ink first:rounded-xl last:rounded-xl"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {/* The server owns the limit; this is the page's own count of
                      the misses it has seen. */}
                  <p
                    className={cn(
                      "mt-3 text-center text-[0.78rem] font-medium",
                      attemptsLeft > 0
                        ? "text-muted-foreground"
                        : "text-[#A81F28]",
                    )}
                    aria-live="polite"
                  >
                    {attemptsLeft > 0
                      ? `${attemptsLeft} of 5 tries left for this code`
                      : "Request a new code below."}
                  </p>

                  <label
                    htmlFor="reset-password"
                    className="mt-4 block text-[0.82rem] font-semibold text-brand-ink"
                  >
                    New password
                  </label>
                  <div className="relative mt-2">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reset-password"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      className="auth-input pl-10"
                      disabled={isLoading}
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                  </div>

                  {error && (
                    <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFF1F3] px-3 py-2.5 text-[0.85rem] text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="auth-submit mt-5 w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        Save new password
                        <ArrowRight className="ml-1 size-4" />
                      </>
                    )}
                  </Button>

                  <div className="mt-4 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleResend()}
                      disabled={isLoading || resendIn > 0}
                      className="rounded-full px-3 py-1.5 text-[0.82rem] font-semibold text-brand-ink/75 underline-offset-4 hover:text-brand-ink hover:underline disabled:text-muted-foreground disabled:no-underline"
                    >
                      {resendIn > 0
                        ? `Resend reset code in ${resendIn}s`
                        : "Resend reset code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendCodeInstead(step.email)}
                      disabled={isLoading}
                      className="text-[0.82rem] font-semibold text-brand-ink/70 underline-offset-4 hover:text-brand-ink hover:underline disabled:opacity-50"
                    >
                      Email me a sign-in code instead
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep({ kind: "email" });
                    setError(null);
                    setOtp("");
                  }}
                  className="mb-4 inline-flex items-center gap-1.5 rounded-full text-[0.85rem] font-semibold text-muted-foreground hover:text-brand-ink"
                >
                  <ArrowLeft className="size-3.5" /> Change email
                </button>

                <h2 className="text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink">
                  Check your inbox
                </h2>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                  A six-digit code was sent to{" "}
                  <span className="font-semibold text-brand-ink">{step.email}</span>.
                </p>

                <form onSubmit={handleOtpSubmit} className="mt-6">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (event.target as HTMLElement).closest("form");
                          form?.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup className="gap-1.5">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="size-11 rounded-xl border border-border bg-white text-lg font-semibold text-brand-ink first:rounded-xl last:rounded-xl"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {/* The server owns the limit; this is the page's own count of
                      the misses it has seen, so it never claims more than it
                      knows. */}
                  <p
                    className={cn(
                      "mt-3 text-center text-[0.78rem] font-medium",
                      attemptsLeft > 0
                        ? "text-muted-foreground"
                        : "text-[#A81F28]",
                    )}
                    aria-live="polite"
                  >
                    {attemptsLeft > 0
                      ? `${attemptsLeft} of 5 tries left for this code`
                      : "Request a new code below."}
                  </p>

                  {error && (
                    <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#FFF1F3] px-3 py-2.5 text-[0.85rem] text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={
                      isLoading || otp.length !== 6 || attemptsLeft === 0
                    }
                    className="auth-submit mt-5 w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      <>
                        Verify and enter
                        <ArrowRight className="ml-1 size-4" />
                      </>
                    )}
                  </Button>

                  <div className="mt-4 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleResend()}
                      disabled={isLoading || resendIn > 0}
                      className="rounded-full px-3 py-1.5 text-[0.82rem] font-semibold text-brand-ink/75 underline-offset-4 hover:text-brand-ink hover:underline disabled:text-muted-foreground disabled:no-underline"
                    >
                      {resendIn > 0
                        ? `Resend code in ${resendIn}s`
                        : "Resend code"}
                    </button>
                    <p className="text-center text-[0.78rem] leading-relaxed text-muted-foreground">
                      Codes expire after 15 minutes. Check your spam folder if it hasn't
                      arrived.
                    </p>
                  </div>
                </form>
              </motion.div>
            )}
          </motion.div>

          <p className="mt-4 text-center text-[0.82rem] text-muted-foreground">
            Every account gets a private workspace ·{" "}
            <Link to="/" className="font-semibold text-brand-ink/70 hover:text-brand-ink">
              Back to home
            </Link>
          </p>

          {/* The trust pages are reachable before sign-in, where they matter. */}
          <nav
            aria-label="Legal"
            className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.78rem] font-medium text-muted-foreground"
          >
            <Link to="/privacy" className="hover:text-brand-ink hover:underline">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-brand-ink hover:underline">
              Terms
            </Link>
            <Link to="/contact" className="hover:text-brand-ink hover:underline">
              Contact
            </Link>
          </nav>
        </div>
      </main>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
