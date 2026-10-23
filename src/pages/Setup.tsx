import { AppShell } from "@/components/AppShell";
import { Pip } from "@/components/Pip";
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
  Sparkles,
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
      setError("Paste the full NVIDIA API key. It's usually a long string starting with nvapi-.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveKey({ key: candidate });
      setKey("");
      setShowKey(false);
      toast.success("NVIDIA key verified and saved on the server.");
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
      toast.error("Could not copy. You can select the command manually.");
    }
  };

  const envConfigured = ai?.source === "env";

  return (
    <AppShell>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-ink/45 transition-colors hover:text-brand-ink"
      >
        <ArrowLeft className="size-3.5" />
        Back to my sets
      </Link>

      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink/40">
            <span className="size-1.5 rounded-full bg-brand-pink-deep" />
            NVIDIA connection
          </p>
          <h1 className="display-tight mt-2 text-[2rem] font-bold leading-none sm:text-[2.5rem]">
            AI setup
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-brand-ink/50">
            Pipnote sends every AI request through NVIDIA. One key on the server serves
            everyone in your group — nobody needs their own key.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-brand-ink/10 bg-white px-3 py-2">
          <Pip size={34} mood={ai?.configured ? "happy" : "sleepy"} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/40">
              Pip status
            </p>
            <p className="text-[12px] font-bold text-brand-ink">
              {ai === undefined
                ? "Checking…"
                : ai.configured
                  ? "Ready to generate"
                  : "Waiting for a key"}
            </p>
          </div>
        </div>
      </header>

      {/* Status */}
      <section
        className={cn(
          "mt-6 rounded-[26px] border p-5 sm:p-6",
          ai?.configured
            ? "border-brand-mint bg-brand-mint/45"
            : "border-brand-lime bg-brand-lime/45",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-ink/10",
              ai?.configured ? "bg-brand-mint" : "bg-brand-lime",
            )}
          >
            {ai === undefined ? (
              <Loader2 className="size-5 animate-spin text-brand-ink/50" />
            ) : ai.configured ? (
              <ShieldCheck className="size-5 text-brand-ink" />
            ) : (
              <AlertCircle className="size-5 text-brand-ink" />
            )}
          </span>
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-brand-ink">
              {ai === undefined
                ? "Checking NVIDIA_API_KEY…"
                : ai.configured
                  ? ai.source === "env"
                    ? "Connected via the deployment environment"
                    : "Connected via a saved server key"
                  : "No NVIDIA key yet"}
            </h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-brand-ink/60">
              {ai === undefined
                ? "Looking for the key on the Convex deployment."
                : ai.configured
                  ? ai.source === "env"
                    ? "NVIDIA_API_KEY is set in the Convex deployment environment and takes priority over any saved key. It is only read by server actions."
                    : "A key is stored in a server-only Convex table. It is never returned by a query or sent to the browser."
                  : "Add your NVIDIA API key below, or set NVIDIA_API_KEY in the deployment environment. Generation stays unavailable until one exists."}
            </p>

            {ai?.configured && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold text-brand-ink/60">
                  <Check className="size-3" /> Verified with NVIDIA
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold text-brand-ink/60">
                  <LockKeyhole className="size-3" /> Never exposed to the frontend
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        {/* Key form / instructions */}
        <section className="rounded-[26px] border border-brand-ink/12 bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">
                {envConfigured ? "Set in the environment" : "Add a key here"}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-brand-ink/50">
                {envConfigured
                  ? "To change it, update NVIDIA_API_KEY in your Convex deployment. A saved key is ignored while the environment variable exists."
                  : "The key is checked with a tiny NVIDIA request before it is stored. It stays on the server."}
              </p>
            </div>
            <KeyRound className="size-5 shrink-0 text-brand-ink/30" />
          </div>

          {!envConfigured ? (
            <form onSubmit={handleSubmit} className="mt-5">
              <label
                htmlFor="nvidia-key"
                className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-ink/45"
              >
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
                    className="h-11 rounded-xl border-brand-ink/15 bg-brand-cream/40 pr-10 font-mono text-[12px]"
                  />
                  <button
                    type="button"
                    aria-label={showKey ? "Hide key" : "Show key"}
                    onClick={() => setShowKey((value) => !value)}
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-brand-ink/35 transition hover:bg-brand-ink/5 hover:text-brand-ink"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={saving || key.trim().length === 0}
                  className="h-11 shrink-0 rounded-xl border-2 border-brand-ink bg-brand-pink px-4 font-bold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Verify
                      <span className="hidden sm:inline">and save</span>
                    </>
                  )}
                </Button>
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-[12px] font-medium text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <p className="mt-2 text-[11px] leading-relaxed text-brand-ink/35">
                Stored in Convex, excluded from the public API. Nothing is printed to the
                console or written to the browser's local storage.
              </p>
            </form>
          ) : (
            <div className="mt-5 rounded-xl border border-brand-ink/10 bg-brand-cream/50 p-4">
              <div className="flex items-start gap-2">
                <Server className="mt-0.5 size-4 shrink-0 text-brand-ink/50" />
                <div>
                  <p className="text-[12px] font-bold text-brand-ink">
                    Prefer the environment variable
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-brand-ink/50">
                    Set NVIDIA_API_KEY once on the deployment, then share the app. Every
                    partner account uses it automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-brand-ink/10 pt-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-ink/40">
              Server environment
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-brand-ink/10 bg-brand-ink px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-brand-cream/80">
                npx convex env set NVIDIA_API_KEY &lt;your-key&gt;
              </code>
              <button
                type="button"
                aria-label="Copy environment command"
                onClick={copyCommand}
                className="grid size-7 shrink-0 place-items-center rounded-md text-brand-cream/50 transition hover:bg-brand-cream/10 hover:text-brand-cream"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-brand-ink/35">
              The exact command depends on how you run Convex. On Freebuff, add
              NVIDIA_API_KEY in the project's Keys tab instead.
            </p>
          </div>

          <div className="mt-5">
            <Button
              asChild
              variant="outline"
              className="h-10 w-full rounded-xl border-brand-ink/15 font-semibold"
            >
              <a href="https://build.nvidia.com/" target="_blank" rel="noreferrer">
                Get a key from NVIDIA Build
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </section>

        {/* Side info */}
        <aside className="space-y-4">
          <section className="rounded-[26px] border border-brand-ink/12 bg-card p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-brand-sky/70">
                <Cpu className="size-3.5 text-brand-ink" />
              </span>
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-brand-ink/60">
                Models in use
              </h2>
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-brand-ink/35">
                  Notes & generation
                </p>
                <p className="break-all font-mono text-[11px] text-brand-ink/65">
                  {ai?.textModel ?? "nvidia/nemotron-3.5-lightning-30b-a3b"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-brand-ink/35">
                  Photo reading
                </p>
                <p className="break-all font-mono text-[11px] text-brand-ink/65">
                  {ai?.visionModel ?? "meta/llama-3.2-90b-vision-instruct"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-brand-ink/35">
              Override with NVIDIA_TEXT_MODEL or NVIDIA_VISION_MODEL if NVIDIA retires a
              model.
            </p>
          </section>

          <section className="rounded-[26px] border border-brand-ink/12 bg-brand-lime/40 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-ink" />
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-brand-ink/60">
                Small-group notes
              </h2>
            </div>
            <ul className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-brand-ink/60">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0" />
                All usage bills to the NVIDIA account that owns the key.
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0" />
                Friends sign in separately and only see their own sets.
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0" />
                Rate limits are handled with clear retry messages.
              </li>
            </ul>
          </section>

          <div className="flex items-center gap-3 rounded-2xl border border-brand-ink/10 bg-white p-3">
            <Pip size={48} />
            <p className="text-[11px] font-medium leading-relaxed text-brand-ink/50">
              Once the key is verified, head back and make your first set.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
