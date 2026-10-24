import { query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import { requireVerifiedUser } from "./lib/authorization";
import {
  NVIDIA_KEY_NAME,
  NVIDIA_TEXT_MODEL,
  NVIDIA_VISION_MODEL,
  readNvidiaKeys,
} from "./lib/nvidiaConfig";

/**
 * Server-side status only. Key values are never returned to the client — just
 * whether AI is configured and which model names the server is using.
 *
 * This endpoint is authenticated and verified-user gated so unverified accounts
 * cannot use it to probe the deployment's secret configuration.
 */
export const aiStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireVerifiedUser(ctx, userId);
    const keys = readNvidiaKeys();

    // Course pathways are scraped, so they need no key. This status only
    // describes the AI used to build study sets, marking and tutoring.
    return {
      configured: keys.length > 0,
      // Do not expose how many keys are loaded. That leaks operational detail
      // that is useful only to an attacker trying keys against the endpoint.
      keyName: NVIDIA_KEY_NAME,
      textModel: NVIDIA_TEXT_MODEL,
      visionModel: NVIDIA_VISION_MODEL,
    };
  },
});
