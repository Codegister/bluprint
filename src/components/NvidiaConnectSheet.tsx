import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import { notifyError } from "@/lib/errors";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Where NVIDIA keys are created and managed. Users sign in there themselves —
 * Bluprint never signs anyone up, and this link is the whole hand-off.
 */
const GET_KEY_URL = "https://build.nvidia.com/settings/api-keys";

const STEPS = [
  "Open build.nvidia.com and sign in with your email. That joins the free NVIDIA Developer Program.",
  "On the API Keys page, choose Generate API Key and copy the key it shows (it starts with nvapi-).",
  "Paste it below. Bluprint checks it with NVIDIA straight away, then saves it encrypted on your account.",
];

export function NvidiaConnectSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const status = useQuery(api.userKeys.status);
  const connect = useAction(api.nvidiaKeys.connect);
  const forget = useMutation(api.userKeys.forget);
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [result, setResult] = useState<
    { tone: "ok" | "error"; text: string } | undefined
  >(undefined);

  const saved = status?.saved === true;
  const canSave = status?.canSave !== false;

  async function check() {
    const candidate = draft.trim();
    if (!candidate || checking) return;
    setChecking(true);
    setResult(undefined);
    try {
      const checked = await connect({ key: candidate });
      if (checked.ok) {
        setDraft("");
        setResult({
          tone: "ok",
          text:
            checked.note ??
            `NVIDIA accepted the key. It's saved, ending ${checked.last4}.`,
        });
        toast.success("Your NVIDIA key is connected.");
      } else {
        setResult({ tone: "error", text: checked.message });
      }
    } catch (error) {
      notifyError(error, "Couldn't check that key. Nothing was saved.");
    } finally {
      setChecking(false);
    }
  }

  async function remove() {
    if (removing) return;
    setRemoving(true);
    try {
      await forget({});
      setResult(undefined);
      toast.success("Your NVIDIA key was removed.");
    } catch (error) {
      notifyError(error, "Couldn't remove that key.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="gap-1.5 border-b border-border p-5">
          <SheetTitle className="font-display flex items-center gap-2 text-lg">
            <KeyRound className="size-4 text-brand-sky" aria-hidden />
            Connect your NVIDIA key
          </SheetTitle>
          <SheetDescription className="text-[0.82rem] leading-relaxed">
            Optional. With your own key, your study sets, marking and tutor
            replies run on your NVIDIA account instead of Bluprint's shared
            one, so a busy day for everyone else can't slow you down.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {saved ? (
            <div className="rounded-2xl border border-border bg-brand-panel/60 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <CheckCircle2
                  className="size-4 text-brand-mint"
                  aria-hidden
                />
                Connected
                {status?.last4 ? ` · ending ${status.last4}` : ""}
              </p>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-muted-foreground">
                Your requests use this key first. If NVIDIA ever rejects it,
                Bluprint falls back to the shared key so your work still runs.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={removing}
                onClick={() => void remove()}
              >
                {removing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : null}
                {removing ? "Removing…" : "Remove key"}
              </Button>
            </div>
          ) : null}

          <div>
            <h3 className="text-[0.72rem] font-semibold tracking-wide text-muted-foreground uppercase">
              Three steps
            </h3>
            <ol className="mt-2 space-y-2">
              {STEPS.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-2.5 text-[0.82rem] leading-relaxed text-brand-ink"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-sky/15 text-[0.68rem] font-semibold text-brand-sky">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <a
              href={GET_KEY_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-brand-sky underline-offset-2 hover:underline"
            >
              Open build.nvidia.com
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>

          <div>
            <label
              htmlFor="nvidia-key"
              className="text-[0.78rem] font-semibold text-brand-ink"
            >
              {saved ? "Paste a replacement key" : "Paste your key"}
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <Input
                id="nvidia-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="nvapi-…"
                value={draft}
                disabled={!canSave || checking}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (result?.tone === "error") setResult(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void check();
                }}
                className="font-mono"
              />
              <Button
                type="button"
                disabled={!canSave || checking || draft.trim().length === 0}
                onClick={() => void check()}
                className="shrink-0"
              >
                {checking ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {checking ? "Checking…" : "Check & save"}
              </Button>
            </div>
            {!canSave ? (
              <p className="mt-2 text-[0.78rem] leading-relaxed text-muted-foreground">
                This workspace isn't set up to store personal keys yet. The
                shared key is still being used for you.
              </p>
            ) : (
              <p className="mt-2 text-[0.78rem] leading-relaxed text-muted-foreground">
                Checked against NVIDIA before it is saved, then stored encrypted
                on your account. It is never shown again and never sent to the
                browser.
              </p>
            )}
            {result ? (
              <p
                role="status"
                className={
                  result.tone === "ok"
                    ? "mt-2 text-[0.78rem] leading-relaxed text-brand-ink"
                    : "mt-2 text-[0.78rem] leading-relaxed text-destructive"
                }
              >
                {result.text}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[0.78rem] leading-relaxed text-muted-foreground">
              {status?.sharedPool
                ? "If you skip this, nothing breaks: Bluprint's shared key builds your sets and answers your tutor questions as it does now."
                : "This workspace has no shared key, so connecting your own is how study sets get built."}
            </p>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
              Your key stays under NVIDIA's trial terms, which are for
              prototyping rather than production use. That is why this is
              optional and never required to try Bluprint.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
