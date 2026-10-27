/**
 * AI provider health.
 *
 * Every NVIDIA call that fails is recorded here (sanitised: purpose, model id,
 * status code — never a key, a prompt or model output). A scheduled sweep looks
 * at the last window and alerts when the same cause keeps happening, which is
 * what makes a retired model impossible to miss: the tutor failing in
 * production for every student used to be visible only to those students.
 *
 * The alert goes to `ALERT_WEBHOOK_URL` when the deployment sets one (a Slack,
 * Discord or generic JSON webhook). Without it, the sweep still writes a
 * clearly-worded line to the deployment log, so the failure is never silent.
 * `ALERT_EMAIL` is accepted as a hint for the webhook body only.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import {
  ALERT_COOLDOWN_MS,
  INCIDENT_WINDOW_MS,
  alertAdvice,
  alertSummary,
  shouldAlert,
} from "./lib/incidentRules";

/** Stores one sanitised provider failure. Internal: only the AI actions write. */
export const record = internalMutation({
  args: {
    purpose: v.string(),
    model: v.string(),
    status: v.number(),
    kind: v.string(),
  },
  handler: async (ctx, { purpose, model, status, kind }) => {
    await ctx.db.insert("aiIncidents", {
      at: Date.now(),
      purpose: purpose.slice(0, 40),
      model: model.slice(0, 80),
      status,
      kind: kind.slice(0, 40),
    });
  },
});

/** Incidents in a window, newest first. Used by the sweep and by hand. */
export const recent = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const rows = await ctx.db
      .query("aiIncidents")
      .withIndex("by_at", (q) => q.gte("at", since))
      .order("desc")
      .collect();
    return rows.slice(0, 200);
  },
});

/** The most recent time an alert was sent, so the cooldown survives restarts. */
export const lastAlertAt = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("aiIncidents")
      .withIndex("by_at")
      .order("desc")
      .collect();
    const alerted = rows.find((row) => row.alertedAt !== undefined);
    return alerted?.alertedAt ?? null;
  },
});

/** Marks a window as alerted so one outage sends one message. */
export const markAlerted = internalMutation({
  args: { since: v.number(), at: v.number() },
  handler: async (ctx, { since, at }) => {
    const rows = await ctx.db
      .query("aiIncidents")
      .withIndex("by_at", (q) => q.gte("at", since))
      .collect();
    for (const row of rows) {
      if (row.alertedAt === undefined) await ctx.db.patch(row._id, { alertedAt: at });
    }
  },
});

/**
 * Looks at the last window and alerts if a cause keeps repeating. Runs on the
 * `crons.ts` schedule; also safe to call by hand.
 */
export const sweep = internalAction({
  args: {},
  handler: async (ctx): Promise<{ alerted: boolean; count: number }> => {
    const now = Date.now();
    const since = now - INCIDENT_WINDOW_MS;
    const rows = await ctx.runQuery(internal.incidents.recent, { since });
    const lastAlert = await ctx.runQuery(internal.incidents.lastAlertAt, {});

    if (!shouldAlert(rows, now, lastAlert ?? undefined)) {
      return { alerted: false, count: rows.length };
    }

    const summary = alertSummary(rows);
    const advice = alertAdvice(rows);
    const webhook = process.env.ALERT_WEBHOOK_URL?.trim();

    if (webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Plain text plus the same text in Slack's `text` field, so one body
          // works for Slack, Discord and a generic endpoint.
          body: JSON.stringify({
            text: `⚠️ ${summary}\n${advice}`,
            summary,
            advice,
            windowMinutes: INCIDENT_WINDOW_MS / 60_000,
            email: process.env.ALERT_EMAIL?.trim() || undefined,
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        console.error("AI alert webhook failed", error);
      }
    } else {
      // No webhook configured: the log line is the alert, and it is written
      // loudly so the platform's own log monitoring can pick it up.
      console.error(`⚠️ AI PROVIDER ALERT — ${summary}. ${advice}`);
    }

    await ctx.runMutation(internal.incidents.markAlerted, { since, at: now });
    return { alerted: true, count: rows.length };
  },
});

/** How many incidents are still unanswered, for an on-demand health check. */
export const health = internalQuery({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - INCIDENT_WINDOW_MS;
    const rows = await ctx.db
      .query("aiIncidents")
      .withIndex("by_at", (q) => q.gte("at", since))
      .collect();
    const byKind = new Map<string, number>();
    for (const row of rows) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);
    return {
      windowMinutes: INCIDENT_WINDOW_MS / 60_000,
      alertCooldownMinutes: ALERT_COOLDOWN_MS / 60_000,
      webhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL?.trim()),
      byKind: Object.fromEntries(byKind),
    };
  },
});
