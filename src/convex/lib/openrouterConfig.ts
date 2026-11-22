/**
 * OpenRouter configuration.
 *
 * OpenRouter has two jobs: the tutor's optional web search, and a free fallback
 * when NVIDIA cannot finish a study-set generation request. Its web plugin
 * researches the question and streams url_citation annotations back, so the
 * chat can show the pages an answer came from. NVIDIA remains the primary
 * provider for all study material.
 *
 * The key is read from `OPENROUTER_API_KEY` and never leaves the server. If the
 * variable is missing the tutor simply answers from the student's material.
 */
export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * A capable, inexpensive model that supports the web plugin. Free OpenRouter
 * models come and go and most reject the plugin, so this defaults to a paid
 * model that is stable; override with OPENROUTER_TUTOR_MODEL if you prefer.
 */
export const OPENROUTER_TUTOR_MODEL =
  process.env.OPENROUTER_TUTOR_MODEL?.trim() || "meta-llama/llama-3.3-70b-instruct";

/**
 * The free model used only when NVIDIA and Groq cannot complete a request.
 *
 * Deliberately not a Nemotron variant: OpenRouter's free NVIDIA endpoints
 * carry NVIDIA's trial-only condition, so routing there would reintroduce the
 * restriction this fallback is meant to avoid. Gemma has a 262K context and a
 * 32K output ceiling, which is enough for a full marking guide or exam answer.
 * Override with OPENROUTER_GENERATION_MODEL when the catalogue changes.
 */
export const OPENROUTER_GENERATION_MODEL =
  process.env.OPENROUTER_GENERATION_MODEL?.trim() ||
  "google/gemma-4-31b-it:free";

/** Returns the configured key, or null when the deployment has none. */
export function readOpenRouterKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key ? key : null;
}
