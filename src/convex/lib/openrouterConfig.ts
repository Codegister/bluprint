/**
 * OpenRouter configuration.
 *
 * OpenRouter is used for one job only: the tutor's optional web search. Its web
 * plugin researches the question and streams url_citation annotations back, so
 * the chat can show the pages an answer came from. Everything that generates
 * study material still goes through NVIDIA.
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

/** Returns the configured key, or null when the deployment has none. */
export function readOpenRouterKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key ? key : null;
}
