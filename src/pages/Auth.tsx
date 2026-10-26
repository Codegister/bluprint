import { Brand } from "@/components/Brand";
import { ChromeBackdrop } from "@/components/ChromeBackdrop";
import { Mascot } from "@/components/Mascot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EASE, enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Ghost, Loader2, Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Could not send the code. Try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch {
      setError("That code didn't work. Check the six digits and try again.");
      setIsLoading(false);
      setOtp("");
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
        guestError instanceof Error
          ? `Could not start a guest session: ${guestError.message}`
          : "Could not start a guest session. Try again.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      {/* The paper wash. The aside carries a heavier plate of its own. */}
      <ChromeBackdrop intensity={0.8} />
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

        <motion.p className="relative text-[0.8rem] text-brand-ink/50" {...enter(0.44)}>
          Your friends keep their own workspace.
        </motion.p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-5 flex items-center justify-between gap-2 lg:hidden">
            <Brand />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/"
                className="rounded-full px-3 py-1.5 text-[0.82rem] font-semibold text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
              >
                ← Home
              </Link>
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
                </h2>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                  Enter your email and we'll send a six-digit code. New here? The same
                  form creates your account.
                </p>

                <form onSubmit={handleEmailSubmit} className="mt-6">
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
                      placeholder="you@university.edu"
                      type="email"
                      autoComplete="email"
                      className="h-12 rounded-2xl border-border bg-white pl-10 text-[0.95rem] text-brand-ink placeholder:text-muted-foreground/60 focus-visible:border-brand-pink/50 focus-visible:ring-brand-pink/20"
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
                    className="chrome-button mt-4 h-12 w-full rounded-full bg-[#191B27] text-[0.95rem] font-semibold text-white hover:bg-[#2A2D3E]"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
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

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-full border-border bg-white text-[0.9rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <Ghost className="size-4" />
                    Continue as guest
                  </Button>
                  <p className="mt-2.5 text-center text-[0.8rem] leading-relaxed text-muted-foreground">
                    Guest sessions are tied to this browser. Use email to keep your sets
                    recoverable.
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

                  {error && (
                    <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#FFF1F3] px-3 py-2.5 text-[0.85rem] text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="chrome-button mt-5 h-12 w-full rounded-full bg-[#191B27] text-[0.95rem] font-semibold text-white hover:bg-[#2A2D3E]"
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

                  <p className="mt-3 text-center text-[0.78rem] leading-relaxed text-muted-foreground">
                    Codes expire after 15 minutes. Check your spam folder if it hasn't
                    arrived.
                  </p>
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
