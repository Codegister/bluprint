import { query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import {
  NVIDIA_KEY_NAME,
  NVIDIA_TEXT_MODEL,
  NVIDIA_VISION_MODEL,
  readNvidiaKeys,
} from "./lib/nvidiaConfig";

/**
 * Public status only. Key values are never returned to the client — just how
 * many keys the server has available and which models are configured.
 */
export const aiStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    const keys = readNvidiaKeys();

    return {
      configured: keys.length > 0,
      keyCount: keys.length,
      keyName: NVIDIA_KEY_NAME,
      textModel: NVIDIA_TEXT_MODEL,
      visionModel: NVIDIA_VISION_MODEL,
    };
  },
});
