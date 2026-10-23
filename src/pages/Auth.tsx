import { Brand } from "@/components/Brand";
import { Pip } from "@/components/Pip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ghost,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
          : "Failed to send your code. Please try again.",
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
          ? `Could not continue as guest: ${guestError.message}`
          : "Could not continue as guest. Please try again.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-ink p-10 text-brand-cream lg:flex xl:p-14">
        <div className="pointer-events-none absolute -left-24 top-1/3 size-96 rounded-full bg-brand-pink/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-0 size-80 rounded-full bg-brand-mint/10 blur-3xl" />
        <div className="relative">
          <Brand tone="dark" />
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-cream/20 bg-brand-lime px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-ink">
            <Sparkles className="size-3.5" /> Your own private study club
          </span>
          <h1 className="display-tight mt-5 text-[3rem] font-bold leading-[1.03] xl:text-[3.4rem]">
            Stop re-reading.
            <br />
            Start{" "}
            <span className="relative inline-block">
              <span className="absolute inset-x-0 bottom-1 h-3 -rotate-1 bg-brand-pink" />
              <span className="relative">remembering.</span>
            </span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-brand-cream/60">
            Your notes become a summary, flashcards, a quiz and exam practice — then stay
            saved here until the exam is over.
          </p>

          <div className="relative mt-10 flex items-end gap-4">
            <div className="relative grid size-32 place-items-center rounded-[32px] border-2 border-brand-cream/20 bg-brand-pink/15">
              <Pip size={112} className="animate-pip-float" cap />
            </div>
            <div className="mb-3 flex-1 rounded-2xl rounded-bl-sm border border-brand-cream/15 bg-brand-cream/[0.07] p-4">
              <p className="text-[13px] font-semibold leading-relaxed text-brand-cream/80">
                “I've read the photos. Your cell biology set is ready: 10 cards, 5 quiz
                questions, 3 exam questions.”
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-cream/35">
                Pip · just now
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-semibold text-brand-cream/45">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-brand-lime" /> Private sets per account
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="size-3.5 text-brand-lime" /> Email code, no password
          </span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Brand />
            <Link
              to="/"
              className="text-[12px] font-semibold text-brand-ink/50 hover:text-brand-ink"
            >
              Back home
            </Link>
          </div>

          <div className="rounded-[30px] border border-brand-ink/12 bg-white p-6 sm:p-8">
            {step === "signIn" ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ink/40">
                      Welcome to Pipnote
                    </p>
                    <h2 className="mt-2 font-display text-[1.75rem] font-bold leading-tight text-brand-ink">
                      Sign in to your sets
                    </h2>
                  </div>
                  <Pip size={62} className="-mt-1 hidden sm:block" mood="happy" />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-brand-ink/55">
                  Enter your email and we'll send a six-digit code. New here? The same form
                  creates your account.
                </p>

                <form onSubmit={handleEmailSubmit} className="mt-6">
                  <label
                    htmlFor="email"
                    className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-ink/50"
                  >
                    Email address
                  </label>
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-ink/35" />
                    <Input
                      id="email"
                      name="email"
                      placeholder="you@university.edu"
                      type="email"
                      autoComplete="email"
                      className="h-11 rounded-xl border-brand-ink/15 bg-brand-cream/50 pl-10 text-sm focus-visible:border-brand-ink/30 focus-visible:ring-brand-pink/30"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  {error && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] font-medium text-destructive">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="mt-4 h-11 w-full rounded-xl border-2 border-brand-ink bg-brand-ink text-sm font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Email me a code
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-brand-ink/10" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-ink/35">
                      or
                    </span>
                    <span className="h-px flex-1 bg-brand-ink/10" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full rounded-xl border-brand-ink/15 font-semibold text-brand-ink hover:bg-brand-cream"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <Ghost className="size-4" />
                    Continue as guest
                  </Button>
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-brand-ink/40">
                    Guest sets live only in this browser session. Use email to keep them
                    recoverable.
                  </p>
                </form>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStep("signIn");
                    setError(null);
                    setOtp("");
                  }}
                  className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-ink/50 hover:text-brand-ink"
                >
                  <ArrowLeft className="size-3.5" /> Different email
                </button>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ink/40">
                      One more step
                    </p>
                    <h2 className="mt-2 font-display text-[1.75rem] font-bold leading-tight text-brand-ink">
                      Check your inbox
                    </h2>
                  </div>
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-brand-ink/10 bg-brand-sky">
                    <Mail className="size-5 text-brand-ink" />
                  </span>
                </div>

                <p className="mt-2 text-[13px] leading-relaxed text-brand-ink/55">
                  We sent a six-digit code to{" "}
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
                      <InputOTPGroup className="gap-1 sm:gap-1.5">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="size-8 rounded-lg border border-brand-ink/15 bg-brand-cream/50 text-sm font-semibold first:rounded-lg last:rounded-lg sm:size-11 sm:rounded-xl sm:text-base sm:first:rounded-xl sm:last:rounded-xl"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {error && (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] font-medium text-destructive">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="mt-5 h-11 w-full rounded-xl border-2 border-brand-ink bg-brand-ink text-sm font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      <>
                        Verify and open my sets
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>

                  <p className="mt-3 text-center text-[11px] text-brand-ink/40">
                    Codes expire after 15 minutes. Check spam if it hasn't arrived.
                  </p>
                </form>
              </>
            )}
          </div>

          <p className="mt-5 text-center text-[11px] text-brand-ink/40">
            By continuing you agree to keep the study group nice.{" "}
            <Link to="/" className="font-semibold text-brand-ink/60 hover:text-brand-ink">
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
