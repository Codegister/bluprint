import { Brand } from "@/components/Brand";
import { ChromeBackdrop } from "@/components/ChromeBackdrop";
import { PageInk } from "@/components/InkInWater";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Mascot } from "@/components/Mascot";
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
import { cn } from "@/lib/utils";
import { useConvex, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

/** How long the page waits before offering another code. */
const RESEND_SECONDS = 60;

/** Seconds remaining until a timestamp, for the page's own countdown. */
function secondsUntil(at: number | undefined, now: number): number {
  if (!at) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/tutor") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
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

  // The address the code was sent to, whether the page has just sent it or is
  // showing the code step after a reload.
  const codeEmail = step === "signIn" ? sentTo : step.email;
  const status = useQuery(
    api.otpGuard.status,
    codeEmail ? { email: codeEmail } : "skip",
  );
  const convex = useConvex();
  const noteCodeSent = useMutation(api.otpGuard.noteCodeSent);
  const recordFailure = useMutation(api.otpGuard.recordFailure);
  const recordSuccess = useMutation(api.otpGuard.recordSuccess);

  // The countdowns run off one clock so the button label, the gate and the
  // server's timestamps never disagree.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const attemptsLeft = status?.attemptsLeft ?? 5;
  const codeUsable = status?.codeUsable ?? true;
  const resendIn = secondsUntil(status?.resendAt, now);
  const retryIn = secondsUntil(status?.retryAt, now);
  const lockedSeconds = secondsUntil(status?.lockedUntil, now);
  const typedResendIn =
    lastSent && lastSent.email === typedEmail.trim().toLowerCase()
      ? Math.max(0, Math.ceil((lastSent.at + RESEND_SECONDS * 1000 - now) / 1000))
      : 0;

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  /** Sends a code and records when, so the resend cooldown is honest. */
  const sendCode = async (email: string): Promise<boolean> => {
    const formData = new FormData();
    formData.set("email", email);
    try {
      await signIn("email-otp", formData);
      await noteCodeSent({ email });
      setSentTo(email);
      setLastSent({ email: email.trim().toLowerCase(), at: Date.now() });
      setStep({ email });
      setError(null);
      return true;
    } catch (signInError) {
      // The provider's own error can name an HTTP status or a mail endpoint.
      // The page shows a readable sentence and logs the rest.
      setError(
        readableError(signInError, "Could not send the code. Try again."),
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
    // The local countdown is only a hint; this is the server's own record, so
    // the cooldown still holds after a reload.
    try {
      const live = await convex.query(api.otpGuard.status, { email });
      const lockedFor = Math.max(
        Math.ceil((live.lockedUntil - Date.now()) / 1000),
        0,
      );
      if (lockedFor > 0) {
        setError(
          `Too many wrong codes for this address. Try again in ${Math.ceil(lockedFor / 60)} minutes, or continue as a guest.`,
        );
        setIsLoading(false);
        return;
      }
      const wait = Math.max(
        Math.ceil((live.resendAt - Date.now()) / 1000),
        0,
      );
      if (wait > 0) {
        setError(`A code was just sent. You can request another in ${wait}s.`);
        setIsLoading(false);
        return;
      }
    } catch {
      // A gate that cannot be read must not strand the student; the send itself
      // still records the attempt.
    }
    await sendCode(email);
    setIsLoading(false);
  };

  /**
   * What the student reads after a wrong code. The count comes from the server,
   * so it is the same after a reload, and it says plainly when the code has
   * been thrown away rather than inviting another guess.
   */
  const failureMessage = (next: {
    attemptsLeft: number;
    codeUsable: boolean;
    retryAt: number;
  }): string => {
    const wait = secondsUntil(next.retryAt, Date.now());
    if (!next.codeUsable) {
      return "That code didn't work, and it has now been cancelled after 5 wrong tries. Request a new code.";
    }
    const left = `${next.attemptsLeft} attempt${next.attemptsLeft === 1 ? "" : "s"} left.`;
    return `That code didn't work. ${left}${wait > 0 ? ` Wait ${wait}s before trying again.` : ""}`;
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (lockedSeconds > 0) {
      setError(
        `Too many wrong codes. Try again in ${Math.ceil(lockedSeconds / 60)} minutes.`,
      );
      return;
    }
    if (!codeUsable) {
      setError(
        "This code was cancelled after 5 wrong tries. Request a new code below.",
      );
      return;
    }
    if (retryIn > 0) {
      setError(`Wait ${retryIn}s before trying another code.`);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? codeEmail);

    setIsLoading(true);    try {
      await signIn("email-otp", formData);
      await recordSuccess({ email });
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

      try {
        const next = await recordFailure({ email });
        setError(failureMessage(next));
      } catch {
        setError("That code didn't work. Check the six digits and try again.");
      }

      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!sentTo || resendIn > 0 || lockedSeconds > 0) return;
    setIsLoading(true);
    const sent = await sendCode(sentTo);
    setIsLoading(false);
    setOtp("");
    if (sent) {
      toast.success("A new code is on its way.");
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
    <div className="min-h-screen lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      {/* The paper wash, then the ink moving through it. The aside carries a
          heavier plate of its own. */}
      <ChromeBackdrop intensity={0.8} />
      <PageInk intensity={1.05} />
      {/* Context panel */}
      <aside className="chrome-rail relative hidden flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex xl:p-14">
        <motion.div className="relative flex items-center justify-between gap-3" {...enter(0.05)}>
          <Brand />
          <ThemeToggle />
        </motion.div>

        <div className="relative flex flex-col items-start">
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          >
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-1/2 size-[236px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-chrome-4/70"
              animate={{ rotate: 360 }}
              transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
            />
            <Mascot size={196} />
          </motion.div>
          <motion.h1
            className="chrome-title mt-6 max-w-md text-[2.5rem] font-extrabold leading-[1.04] tracking-[-0.04em] xl:text-[2.9rem]"
            {...enter(0.2)}
          >
            Your sets, scores and progress,{" "}
            <span className="highlighter">kept together.</span>
          </motion.h1>
          <motion.p
            className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-brand-ink/65"
            {...enter(0.28)}
          >
            Sign in to build summaries, flashcards, quizzes and exam practice from your
            uploads. Everything stays attached to your account.
          </motion.p>

          <motion.p
            className="mt-7 text-[0.85rem] font-medium leading-relaxed text-brand-ink/60"
            {...enter(0.36)}
          >
            Private to your account. No password to remember, just a six-digit email
            code.
          </motion.p>
        </div>

        <motion.p className="relative text-[0.8rem] text-brand-ink/65" {...enter(0.44)}>
          Your friends keep their own workspace.
        </motion.p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-5 flex items-center justify-between gap-2 lg:hidden">
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
            className="gizmo-card overflow-hidden p-6 sm:p-8"
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
          >
            {/* Each step fades in from its side. Swapping in place (rather than
                waiting for an exit) keeps the card's height honest. */}
            {step === "signIn" ? (
              <motion.div
                key="sign-in"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <h2 className="text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink">
                  Sign in to your workspace
                </h2>                  <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                    We&apos;ll email you a six-digit code. New here? The same form
                    creates your account.
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
                      className="h-12 rounded-2xl border-border bg-white pl-10 text-[0.95rem] text-brand-ink placeholder:text-muted-foreground/90 focus-visible:border-brand-pink/50 focus-visible:ring-brand-pink/20"
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
                    className="chrome-button mt-4 h-12 w-full rounded-full bg-[#191B27] text-[0.95rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/40"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : typedResendIn > 0 ? (
                      <>Send another in {typedResendIn}s</>
                    ) : (
                      <>
                        Send code
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

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
                    setStep("signIn");
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

                  {/* The limit is stated before it is hit, and the count is
                      the server's, so it matches after a reload. */}
                  <p
                    className={cn(
                      "mt-3 text-center text-[0.78rem] font-medium",
                      codeUsable ? "text-muted-foreground" : "text-[#A81F28]",
                    )}
                    aria-live="polite"
                  >
                    {!status
                      ? "Checking this code…"
                      : lockedSeconds > 0
                        ? `Too many wrong codes. Try again in ${Math.ceil(lockedSeconds / 60)} minutes.`
                        : !codeUsable
                          ? "This code was cancelled after 5 wrong tries. Request a new one."
                          : `${attemptsLeft} of 5 tries left for this code`}
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
                      isLoading ||
                      otp.length !== 6 ||
                      lockedSeconds > 0 ||
                      retryIn > 0 ||
                      !codeUsable
                    }
                    className="chrome-button mt-5 h-12 w-full rounded-full bg-[#191B27] text-[0.95rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/40"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Verifying…
                      </>
                    ) : retryIn > 0 ? (
                      <>Try again in {retryIn}s</>
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
                      disabled={isLoading || resendIn > 0 || lockedSeconds > 0}
                      className="rounded-full px-3 py-1.5 text-[0.82rem] font-semibold text-brand-ink/75 underline-offset-4 hover:text-brand-ink hover:underline disabled:text-muted-foreground disabled:no-underline"
                    >
                      {lockedSeconds > 0
                        ? `Locked for ${Math.ceil(lockedSeconds / 60)} more minutes`
                        : resendIn > 0
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
