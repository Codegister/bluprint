import { query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import {
  INCIDENT_WINDOW_MS,
  deploymentKeyState,
  type DeploymentKeyState,
} from "./lib/incidentRules";
import {
  DEFAULT_TUTOR_TIER_LABEL,
  TUTOR_TIER_DETAILS,
  TUTOR_TIER_LABELS,
  readNvidiaKeys,
} from "./lib/nvidiaConfig";

/**
 * Server-side AI status only. Key values are never returned to the client.
 *
 * This endpoint is authenticated so unauthenticated requests cannot probe the
 * deployment's AI configuration, but it is deliberately NOT gated by email
 * verification. Verifying the email address is required before this app sends
 * sign-in codes and before it lets an account build study sets, but reading
 * whether the server AI is configured is safe for an unverified guest account
 * and should not block the app's status check.
 */
export const aiStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const keys = readNvidiaKeys();

    // A user's own connected key counts as AI being available even when the
    // deployment has no shared pool left, because their requests go out on it.
    const ownKey = await ctx.db
      .query("userNvidiaKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Why the deployment's own pool cannot serve requests, when it cannot. A
    // missing key and a key the provider refuses read the same to a student,
    // but only the second one has a provider to complain about, and the app
    // showing the difference is what turns a silent outage into something the
    // owner sees before a build fails.
    let deploymentKeys: DeploymentKeyState = "missing";
    if (keys.length > 0) {
      const incidents = await ctx.db
        .query("aiIncidents")
        .withIndex("by_at", (q) => q.gte("at", Date.now() - INCIDENT_WINDOW_MS))
        .order("desc")
        .take(200);
      deploymentKeys = deploymentKeyState(keys.length, incidents);
    }

    // Course pathways are scraped, so they need no key. This status only
    // describes the AI used to build study sets, marking and tutoring.
    return {
      configured: keys.length > 0 || ownKey !== null,
      // "ok", "missing" or "refused". No key values, no counts, no names: the
      // app only needs to know which sentence to show.
      deploymentKeys,
      // Neither the number of keys nor the environment variable name is
      // returned: both are operational detail, and the UI has no use for them.
      // Exactly three levels, in order: Fast, Balanced, Deep. The NVIDIA model
      // behind each one stays on the server.
      tutorTiers: TUTOR_TIER_LABELS,
      // Tagline and icon name per label, so the picker can say "Longest answers"
      // next to Deep and draw a different glyph for every level.
      tutorTierDetails: TUTOR_TIER_DETAILS,
      defaultTutorTier: DEFAULT_TUTOR_TIER_LABEL,
    };
  },
});
