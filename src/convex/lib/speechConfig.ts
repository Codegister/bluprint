/**
 * Speech-to-text configuration for tutor dictation.
 *
 * Dictation is transcribed on the server: the browser records a short clip and
 * posts it to the `ai.transcribeDictation` action, so no key is ever exposed to
 * the page. Providers are tried in this order, and a provider that is missing
 * or fails simply hands over to the next one:
 *
 *   1. NVIDIA's own speech endpoint, when `NVIDIA_ASR_URL` is set. NVIDIA hosts
 *      Parakeet and Whisper as per-model NVCF/NIM deployments rather than on
 *      integrate.api.nvidia.com, so the endpoint address is configuration, not
 *      a constant: copy the invocation URL from the model's build.nvidia.com
 *      API tab and set it as `NVIDIA_ASR_URL`. `NVIDIA_API_KEY` authenticates it.
 *   2. NVIDIA's Parakeet model through OpenRouter's transcription endpoint,
 *      using `OPENROUTER_API_KEY`.
 *   3. OpenAI's Whisper through the same OpenRouter endpoint, as a last resort.
 *
 * Nothing here invents a key or prints one. When no provider is configured the
 * action says exactly which variable to set.
 */

/** OpenRouter's OpenAI-compatible transcription endpoint. */
export const OPENROUTER_STT_URL = "https://openrouter.ai/api/v1/audio/transcriptions";

/**
 * Address of an NVIDIA-hosted speech (Riva / NIM / NVCF) transcription route,
 * for example `https://<id>.invocation.api.nvcf.nvidia.com/v1/audio/transcriptions`.
 * Empty means "use OpenRouter instead".
 */
export const NVIDIA_ASR_URL = process.env.NVIDIA_ASR_URL?.trim() ?? "";

/**
 * Some NVCF deployments also want the model's function id as a `function-id`
 * header. Optional, and only sent when set.
 */
export const NVIDIA_ASR_FUNCTION_ID =
  process.env.NVIDIA_ASR_FUNCTION_ID?.trim() ?? "";

/** The NVIDIA speech model asked for when the endpoint accepts a model field. */
export const NVIDIA_ASR_MODEL =
  process.env.NVIDIA_ASR_MODEL?.trim() || "nvidia/parakeet-tdt-0.6b-v3";

/**
 * OpenRouter transcription models, NVIDIA's own model first as requested.
 * Override the whole list with `OPENROUTER_STT_MODELS` (comma separated).
 */
export const OPENROUTER_STT_MODELS: string[] = (() => {
  const raw = process.env.OPENROUTER_STT_MODELS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);
  }
  return ["nvidia/parakeet-tdt-0.6b-v3", "openai/whisper-large-v3-turbo"];
})();

/**
 * Recordings are capped in the browser at a minute, so anything far larger than
 * that is not a dictation and is rejected instead of being uploaded.
 */
export const MAX_DICTATION_BYTES = 8 * 1024 * 1024;

/** Container formats the browser recorder can produce and the providers accept. */
export const DICTATION_FORMATS = new Set([
  "webm",
  "m4a",
  "mp4",
  "ogg",
  "wav",
  "mp3",
  "aac",
  "flac",
]);

/** MIME type used when the audio is uploaded as a file. */
export function dictationMimeType(format: string): string {
  switch (format) {
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    default:
      return "audio/webm";
  }
}
