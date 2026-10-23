import { Brand } from "@/components/Brand";
import { BlueprintGlyph } from "@/components/BlueprintMark";
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
  Check,
  Ghost,
  Loader2,
  Lock,
  Mail,
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
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      {/* Context panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-brand-panel/40 p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_72%)]" />
        <div className="pointer-events-none absolute -left-24 top-1/4 size-96 rounded-full bg-brand-pink/[0.06] blur-3xl" />
        <BlueprintGlyph
          size={420}
          className="pointer-events-none absolute -bottom-28 -right-28 opacity-20"
        />

        <div className="relative">
          <Brand />
        </div>

        <div className="relative max-w-lg">
          <div className="inline-flex items-center gap-2 rounded border border-border bg-background/70 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand-mint" />
            PRIVATE WORKSPACE
          </div>
          <h1 className="display-tight mt-5 text-[2.9rem] font-semibold leading-[1.02] xl:text-[3.3rem]">
            Your notes are raw input.
            <br />
            <span className="text-brand-pink">Make them retrievable.</span>
          </h1>
          <p className="mt-5 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
            Sign in to compile notes into summaries, cards, quizzes and exam practice. Your
            uploads, sets and scores stay attached to your account.
          </p>

          <div className="mt-9 overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground">
                SESSION
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-wide text-brand-mint">
                <span className="size-1.5 rounded-full bg-brand-mint" />
                READY
              </span>
            </div>
            <div className="space-y-2 p-3 font-mono text-[10.5px] leading-5">
              <p className="text-muted-foreground">
                <span className="text-brand-mint">→</span> authenticate
                <span className="float-right text-brand-ink/65">email code</span>
              </p>
              <p className="text-muted-foreground">
                <span className="text-brand-mint">→</span> load workspace
                <span className="float-right text-brand-ink/65">private</span>
              </p>
              <p className="text-muted-foreground">
                <span className="text-brand-mint">→</span> compile sets
                <span className="float-right text-brand-ink/65">nvidia</span>
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex flex-wrap gap-x-6 gap-y-2 font-mono text-[9.5px] tracking-wide text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3 text-brand-pink" /> PRIVATE PER ACCOUNT
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-3 text-brand-pink" /> NO PASSWORDS
          </span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <Brand />
            <Link
              to="/"
              className="font-mono text-[10px] tracking-wide text-muted-foreground hover:text-brand-ink"
            >
              ← HOME
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 sm:p-7">
            {step === "signIn" ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono-label text-brand-pink">AUTH / EMAIL CODE</p>
                    <h2 className="mt-2.5 font-display text-[1.65rem] font-semibold leading-tight text-brand-ink">
                      Sign in to your workspace
                    </h2>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-brand-panel">
                    <Mail className="size-4 text-muted-foreground" />
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  Enter your email and we'll send a six-digit code. New here? The same form
                  creates your account.
                </p>

                <form onSubmit={handleEmailSubmit} className="mt-6">
                  <label
                    htmlFor="email"
                    className="mono-label text-muted-foreground"
                  >
                    EMAIL ADDRESS
                  </label>
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      placeholder="you@university.edu"
                      type="email"
                      autoComplete="email"
                      className="h-10 rounded-md border-border bg-brand-panel pl-9 text-sm text-brand-ink placeholder:text-muted-foreground/60 focus-visible:border-brand-pink/50 focus-visible:ring-brand-pink/20"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  {error && (
                    <p className="mt-3 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="mt-4 h-10 w-full rounded-md bg-brand-pink font-mono text-[11px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        SEND CODE
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </Button>

                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
                      OR
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full rounded-md border-border bg-transparent font-mono text-[10.5px] tracking-wide text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <Ghost className="size-3.5" />
                    CONTINUE AS GUEST
                  </Button>
                  <p className="mt-2 text-center text-[10.5px] leading-relaxed text-muted-foreground/70">
                    Guest sessions are tied to this browser. Use email to keep your sets
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
                  className="mb-4 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-muted-foreground hover:text-brand-ink"
                >
                  <ArrowLeft className="size-3" /> CHANGE EMAIL
                </button>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono-label text-brand-pink">AUTH / VERIFY</p>
                    <h2 className="mt-2.5 font-display text-[1.65rem] font-semibold leading-tight text-brand-ink">
                      Check your inbox
                    </h2>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-brand-panel">
                    <Mail className="size-4 text-muted-foreground" />
                  </span>
                </div>

                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  A six-digit code was sent to{" "}
                  <span className="font-medium text-brand-ink">{step.email}</span>.
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
                            className="size-8 rounded border border-border bg-brand-panel font-mono text-sm text-brand-ink first:rounded last:rounded sm:size-11 sm:rounded-md sm:first:rounded-md sm:last:rounded-md"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {error && (
                    <p className="mt-4 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="mt-5 h-10 w-full rounded-md bg-brand-pink font-mono text-[11px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                        VERIFYING…
                      </>
                    ) : (
                      <>
                        VERIFY AND ENTER
                        <ArrowRight className="ml-2 size-3.5" />
                      </>
                    )}
                  </Button>

                  <p className="mt-3 text-center font-mono text-[9.5px] leading-relaxed text-muted-foreground/70">
                    CODES EXPIRE AFTER 15 MINUTES. CHECK SPAM IF NEEDED.
                  </p>
                </form>
              </>
            )}
          </div>

          <p className="mt-4 text-center font-mono text-[9.5px] tracking-wide text-muted-foreground/60">
            EACH ACCOUNT GETS A PRIVATE WORKSPACE ·{" "}
            <Link to="/" className="text-muted-foreground hover:text-brand-ink">
              BACK TO HOME
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
