import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";

/**
 * The remaining tutor or marking allowance, shown before it runs out.
 *
 * Nothing renders when a healthy personal key pays, because there is no
 * app-level cap then. On the shared pool the line appears once the account is
 * within a few requests of the hourly cap (or a day's worth of it), so the
 * student sees it coming instead of meeting it as a refusal. The numbers and
 * the wording come from the server, so they cannot drift from what is enforced.
 */
const WARN_AT_HOUR = 5;
const WARN_AT_DAY = 10;

export function AiAllowance({
  kind,
  className,
}: {
  kind: "tutor" | "marking";
  className?: string;
}) {
  const status = useQuery(api.aiUsage.status, { kind });
  if (!status || status.unlimited) return null;

  const outOfHour = status.remainingHour <= 0;
  const outOfDay = status.remainingToday <= 0;
  const nearlyOut =
    status.remainingHour <= WARN_AT_HOUR || status.remainingToday <= WARN_AT_DAY;
  if (!nearlyOut) return null;

  const wait = outOfHour
    ? ` Resets in about ${status.retryMinutes} ${status.retryMinutes === 1 ? "minute" : "minutes"}.`
    : outOfDay
      ? ` Resets in about ${status.retryMinutesToday} minute${status.retryMinutesToday === 1 ? "" : "s"}.`
      : "";

  return (
    <p
      role={outOfHour || outOfDay ? "alert" : "status"}
      className={cn(
        "rounded-2xl px-3.5 py-2.5 text-[0.78rem] leading-relaxed",
        outOfHour || outOfDay
          ? "bg-[#FFEEF0] text-[#A81F28]"
          : "bg-brand-panel text-brand-ink/75",
        className,
      )}
    >
      {outOfHour || outOfDay ? (
        <>
          Shared key limit reached for {status.label}.{wait} Connect your own API
          key from the account menu for no limit.
        </>
      ) : (
        <>
          {status.remainingHour} of {status.perHour} {status.label} left this hour
          {status.remainingToday <= WARN_AT_DAY
            ? `, ${status.remainingToday} today`
            : ""}
          . Connect your own API key from the account menu for no limit.
        </>
      )}
    </p>
  );
}
