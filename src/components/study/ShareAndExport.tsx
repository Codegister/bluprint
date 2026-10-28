import { api } from "@/convex/_generated/api";
import { notifyError } from "@/lib/errors";
import { downloadTextFile } from "@/lib/studyExport";
import { accountExportJson } from "@/lib/studyExport";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Download, Link2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

/**
 * A read-only progress link for a teacher or parent.
 *
 * Creating one revokes any earlier link, so there is always exactly one live
 * address to manage. The token is random and the page behind it shows only
 * aggregates — never notes, cards or answers.
 */
export function ShareProgressButton() {
  const mine = useQuery(api.progressShares.mine);
  const create = useMutation(api.progressShares.create);
  const revoke = useMutation(api.progressShares.revoke);
  const [busy, setBusy] = useState(false);

  const active = mine?.find((row) => row.active) ?? null;
  const url = active ? `${window.location.origin}${BASE}/share/${active.token}` : "";

  const make = async () => {
    setBusy(true);
    try {
      const result = await create();
      const link = `${window.location.origin}${BASE}${result.path}`;
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      toast.success("Progress link created and copied.");
    } catch (error) {
      notifyError(error, "Could not create a share link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-[0.84rem] font-semibold text-brand-ink">
        <Link2 className="size-4 text-chrome-7" aria-hidden />
        Share progress
      </p>
      <p className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
        A read-only link for a teacher or parent: coverage, streak and weak
        topics. No notes, cards or answers are included, and you can revoke it.
      </p>
      {active ? (
        <div className="mt-2 space-y-1.5">
          <code className="block truncate rounded-lg bg-brand-panel px-2 py-1.5 text-[0.7rem] text-brand-ink/80">
            {url}
          </code>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard?.writeText(url).then(
                  () => toast.success("Link copied."),
                  () => toast.error("Could not copy the link."),
                )
              }
              className="rounded-full border border-border bg-white px-3 py-1.5 text-[0.72rem] font-semibold text-brand-ink/80 hover:bg-brand-panel"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={() => void revoke({ shareId: active._id })}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-[0.72rem] font-semibold text-[#A81F28] hover:bg-[#FFEEF0]"
            >
              Revoke
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void make()}
          disabled={busy || mine === undefined}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#191B27] px-3.5 py-1.5 text-[0.74rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Create a progress link
        </button>
      )}
    </div>
  );
}

/** The whole account as one JSON file: notes, cards, answers and marks. */
export function AccountExportButton({ className }: { className?: string }) {
  const data = useQuery(api.exports.forAccount);
  const [busy, setBusy] = useState(false);

  const run = () => {
    if (!data) return;
    setBusy(true);
    try {
      const json = accountExportJson({
        email: data.email,
        name: data.name,
        exportedAt: data.exportedAt,
        streak: data.streak,
        sets: data.sets,
      });
      downloadTextFile(
        `bluprint-account-${new Date(data.exportedAt).toISOString().slice(0, 10)}.json`,
        json,
        "application/json",
      );
      toast.success("Account export downloaded.");
    } catch (error) {
      notifyError(error, "Could not build the export.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={!data || busy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[0.74rem] font-semibold text-brand-ink/80 hover:bg-brand-panel disabled:opacity-60",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Download className="size-3.5" aria-hidden />
      )}
      Download my data
      <ShieldCheck className="size-3.5 text-chrome-7" aria-hidden />
    </button>
  );
}
