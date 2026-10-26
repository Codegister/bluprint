import { query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import {
  DEFAULT_TUTOR_TIER_LABEL,
  NVIDIA_KEY_NAME,
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
    await requireUserId(ctx);
    const keys = readNvidiaKeys();

    // Course pathways are scraped, so they need no key. This status only
    // describes the AI used to build study sets, marking and tutoring.
    return {
      configured: keys.length > 0,
      // Do not expose how many keys are loaded. That leaks operational detail
      // that is useful only to an attacker trying keys against the endpoint.
      keyName: NVIDIA_KEY_NAME,
      // Tutor tiers are shown by label only: Ultra (ultra fast) through Max
      // (maximum strength). The NVIDIA model behind each one stays on the server.
      tutorTiers: TUTOR_TIER_LABELS,
      defaultTutorTier: DEFAULT_TUTOR_TIER_LABEL,
    };
  },
});
