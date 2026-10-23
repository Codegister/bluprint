/**
 * NVIDIA API configuration.
 *
 * Keys are NEVER defined in source. They are read from the `NVIDIA_API_KEY`
 * environment variable, which may hold one key or several keys separated by
 * commas, semicolons, or newlines. The AI action rotates across them so a
 * single key's rate limit does not stop a study set from compiling.
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

/** Name used everywhere the key pool is referenced. */
export const NVIDIA_KEY_NAME = "NVIDIA_API_KEY";

/**
 * Splits NVIDIA_API_KEY into a de-duplicated key pool. Accepts comma-,
 * semicolon-, whitespace-, or newline-separated values so a few keys can be
 * supplied without inventing additional environment variable names.
 */
export function readNvidiaKeys(): string[] {
  const raw = process.env.NVIDIA_API_KEY ?? "";
  const keys = raw
    .split(/[\s,;]+/)
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

/** Keep prompts bounded so a giant PDF paste does not blow the context window. */
export const MAX_NOTES_CHARS = 12_000;
