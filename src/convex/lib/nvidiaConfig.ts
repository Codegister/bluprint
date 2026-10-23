/**
 * NVIDIA API configuration.
 *
 * The API key itself is NEVER defined here. It is always read from the
 * `NVIDIA_API_KEY` environment variable (or, as a fallback for local friend
 * groups, the server-only setting saved from the AI setup screen).
 *
 * Model IDs can be overridden with NVIDIA_TEXT_MODEL / NVIDIA_VISION_MODEL if
 * NVIDIA retires the defaults. See the README.
 */
export const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// These are the defaults checked against NVIDIA's live model catalog. NVIDIA
// retires models periodically — override with the env vars below (or edit
// here) if one reaches end of life, as shown by a 410 response.
export const NVIDIA_TEXT_MODEL =
  process.env.NVIDIA_TEXT_MODEL?.trim() ||
  "nvidia/nemotron-3.5-lightning-30b-a3b";

export const NVIDIA_VISION_MODEL =
  process.env.NVIDIA_VISION_MODEL?.trim() ||
  "meta/llama-3.2-90b-vision-instruct";

/** Name used everywhere the key is referenced. */
export const NVIDIA_KEY_NAME = "NVIDIA_API_KEY";

/** Keep prompts bounded so a giant PDF paste does not blow the context window. */
export const MAX_NOTES_CHARS = 12_000;
