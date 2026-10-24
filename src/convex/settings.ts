import { query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import {
  NVIDIA_KEY_NAME,
  NVIDIA_TEXT_MODEL,
  NVIDIA_VISION_MODEL,
  readNvidiaKeys,
} from "./lib/nvidiaConfig";
import {
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_KEY_NAME,
  readOpenRouterKey,
  readOpenRouterModelOverride,
} from "./lib/openrouterConfig";

/**
 * Public status only. Key values are never returned to the client — just how
 * many keys the server has available and which models are configured.
 */
export const aiStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    const keys = readNvidiaKeys();
    const openRouterConfigured = readOpenRouterKey() !== null;

    return {
      configured: keys.length > 0,
      keyCount: keys.length,
      keyName: NVIDIA_KEY_NAME,
      textModel: NVIDIA_TEXT_MODEL,
      visionModel: NVIDIA_VISION_MODEL,
      // Course pathways prefer a larger free OpenRouter model. NVIDIA remains
      // the fallback, so pathways work with either key.
      pathway: {
        configured: openRouterConfigured || keys.length > 0,
        provider: openRouterConfigured ? "openrouter" : keys.length > 0 ? "nvidia" : null,
        keyName: OPENROUTER_KEY_NAME,
        model:
          readOpenRouterModelOverride() ??
          (openRouterConfigured ? OPENROUTER_DEFAULT_MODEL : NVIDIA_TEXT_MODEL),
      },
    };
  },
});
