import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Setup() {
  const ai = useQuery(api.settings.aiStatus);
  const saveKey = useAction(api.ai.saveNvidiaKey);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = key.trim();
    if (candidate.length < 20) {
      setError("Paste the full NVIDIA API key. It usually starts with nvapi-.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveKey({ key: candidate });
      setKey("");
      setShowKey(false);
      toast.success("NVIDIA key verified and stored on the server.");
    } catch (saveError) {
      setError(
        readableError(
          saveError,
          "NVIDIA could not verify that key. Check it and try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(
        "npx convex env set NVIDIA_API_KEY <your-key>",
      );
      toast.success("Command copied. Replace <your-key> before running it.");
    } catch {
      toast.error("Could not copy. Select the command manually.");
    }
  };

  const envConfigured = ai?.source === "env";

  return (
    <AppShell>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-wide text-muted-foreground transition-colors hover:text-brand-ink"
      >
        <ArrowLeft className="size-3" />
        DASHBOARD / API ACCESS
      </Link>

      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-label flex items-center gap-2 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand-pink" />
            CONFIGURATION / MODEL ACCESS
          </p>
          <h1 className="display-tight mt-2.5 text-[2rem] font-semibold leading-none sm:text-[2.4rem]">
            API access
          </h1>
          <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
            All model calls run through NVIDIA on the server. One key serves the whole
            workspace; friends do not need their own.
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
          <span
            className={cn(
              "grid size-8 place-items-center rounded border",
              ai?.configured
                ? "border-brand-mint/25 bg-brand-mint/10 text-brand-mint"
                : "border-brand-lime/25 bg-brand-lime/10 text-brand-lime",
            )}
          >
            {ai === undefined ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : ai.configured ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <AlertCircle className="size-3.5" />
            )}
          </span>
          <div>
            <p className="mono-label text-muted-foreground">PIPELINE</p>
            <p className="mt-0.5 font-mono text-[10px] text-brand-ink">
              {ai === undefined
                ? "CHECKING"
                : ai.configured
                  ? "OPERATIONAL"
                  : "KEY REQUIRED"}
            </p>
          </div>
        </div>
      </header>

      <section
        className={cn(
          "mt-6 rounded-xl border p-5 sm:p-6",
          ai?.configured
            ? "border-brand-mint/20 bg-brand-mint/[0.04]"
            : "border-brand-lime/25 bg-brand-lime/[0.04]",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-md border",
              ai?.configured
                ? "border-brand-mint/25 bg-brand-mint/10 text-brand-mint"
                : "border-brand-lime/25 bg-brand-lime/10 text-brand-lime",
            )}
          >
            {ai === undefined ? (
              <Loader2 className="size-4 animate-spin" />
            ) : ai.configured ? (
              <ShieldCheck className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
          </span>
          <div className="flex-1">
            <p className="mono-label text-muted-foreground">NVIDIA_API_KEY</p>
            <h2 className="mt-1.5 font-display text-lg font-semibold text-brand-ink">
              {ai === undefined
                ? "Checking the deployment…"
                : ai.configured
                  ? ai.source === "env"
                    ? "Connected through the environment"
                    : "Connected through a saved server key"
                  : "No key configured"}
            </h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
              {ai === undefined
                ? "Looking for NVIDIA_API_KEY on the Convex deployment."
                : ai.configured
                  ? ai.source === "env"
                    ? "NVIDIA_API_KEY is set in the deployment environment and takes priority over any saved fallback. It is only read by server functions."
                    : "A key is stored in a server-only Convex table. It is never returned by a query or sent to the browser."
                  : "Add a key below, or set NVIDIA_API_KEY in the deployment environment. Set compilation stays paused until one is present."}
            </p>

            {ai?.configured && (
              <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[9px] tracking-wide">
                <span className="inline-flex items-center gap-1 rounded border border-brand-mint/20 bg-brand-mint/[0.06] px-1.5 py-0.5 text-brand-mint">
                  <Check className="size-2.5" /> VERIFIED
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-border bg-brand-panel px-1.5 py-0.5 text-muted-foreground">
                  <LockKeyhole className="size-2.5" /> SERVER ONLY
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mono-label text-muted-foreground">CONFIGURATION</p>
              <h2 className="mt-1.5 font-display text-lg font-semibold">
                {envConfigured ? "Set by the environment" : "Save a fallback key"}
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {envConfigured
                  ? "To rotate it, update NVIDIA_API_KEY on the Convex deployment. A saved key is ignored while the environment variable exists."
                  : "The key is verified with NVIDIA before it is stored. It stays on the server."}
              </p>
            </div>
            <KeyRound className="size-4 shrink-0 text-muted-foreground" />
          </div>

          {!envConfigured ? (
            <form onSubmit={handleSubmit} className="mt-5">
              <label htmlFor="nvidia-key" className="mono-label text-muted-foreground">
                NVIDIA_API_KEY
              </label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="nvidia-key"
                    type={showKey ? "text" : "password"}
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder="nvapi-…"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={saving}
                    className="h-10 rounded-md border-border bg-brand-panel pr-10 font-mono text-[11px] text-brand-ink placeholder:text-muted-foreground/60"
                  />
                  <button
                    type="button"
                    aria-label={showKey ? "Hide key" : "Show key"}
                    onClick={() => setShowKey((value) => !value)}
                    className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-brand-ink"
                  >
                    {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={saving || key.trim().length === 0}
                  className="h-10 shrink-0 rounded-md bg-brand-pink px-4 font-mono text-[10px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      Verify
                      <span className="hidden sm:inline">and save</span>
                    </>
                  )}
                </Button>
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-[11px] leading-relaxed text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <p className="mt-2 font-mono text-[9px] leading-relaxed tracking-wide text-muted-foreground/60">
                STORED IN CONVEX / EXCLUDED FROM THE PUBLIC API / NEVER LOGGED
              </p>
            </form>
          ) : (
            <div className="mt-5 rounded-md border border-border bg-brand-panel p-4">
              <div className="flex items-start gap-2">
                <Server className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[11.5px] font-medium text-brand-ink">
                    Environment variable preferred
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    Set NVIDIA_API_KEY once on the deployment, then share the app. Every
                    account uses the same pipeline.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <p className="mono-label text-muted-foreground">SERVER ENVIRONMENT</p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5">
              <Terminal className="size-3.5 shrink-0 text-brand-pink" />
              <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-brand-ink/70">
                npx convex env set NVIDIA_API_KEY &lt;your-key&gt;
              </code>
              <button
                type="button"
                aria-label="Copy environment command"
                onClick={copyCommand}
                className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-brand-panel hover:text-brand-ink"
              >
                <Copy className="size-3" />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
              Exact steps depend on how Convex is hosted. On Freebuff, add NVIDIA_API_KEY in
              the project's Keys tab.
            </p>
          </div>

          <div className="mt-4">
            <Button
              asChild
              variant="outline"
              className="h-9 w-full rounded-md border-border bg-transparent font-mono text-[10px] tracking-wide"
            >
              <a href="https://build.nvidia.com/" target="_blank" rel="noreferrer">
                GET A KEY FROM NVIDIA BUILD
                <ExternalLink className="size-3" />
              </a>
            </Button>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Cpu className="size-3.5 text-brand-sky" />
              <h2 className="mono-label text-muted-foreground">MODELS IN USE</h2>
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <p className="font-mono text-[9px] tracking-wide text-muted-foreground/70">
                  NOTES / GENERATION
                </p>
                <p className="mt-0.5 break-all font-mono text-[10px] text-brand-ink/75">
                  {ai?.textModel ?? "nvidia/nemotron-3.5-lightning-30b-a3b"}
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] tracking-wide text-muted-foreground/70">
                  PHOTO READING
                </p>
                <p className="mt-0.5 break-all font-mono text-[10px] text-brand-ink/75">
                  {ai?.visionModel ?? "meta/llama-3.2-90b-vision-instruct"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/70">
              Override with NVIDIA_TEXT_MODEL or NVIDIA_VISION_MODEL if a model is retired.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-brand-mint" />
              <h2 className="mono-label text-muted-foreground">OPERATING NOTES</h2>
            </div>
            <ul className="mt-3 space-y-2 text-[10.5px] leading-relaxed text-muted-foreground">
              {[
                "Usage bills to the NVIDIA account that owns the key.",
                "Friends sign in separately and only see their own sets.",
                "Rate limits are retried briefly, then reported per set.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3 shrink-0 text-brand-mint" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
