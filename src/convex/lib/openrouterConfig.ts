/**
 * OpenRouter configuration for course-pathway generation.
 *
 * Building a full specification tree is a harder task than summarising one
 * page of notes, so Bluprint sends it to a larger model. OpenRouter's free
 * catalogue is used by default because it costs nothing to run for a few
 * friends. Keys are read from `OPENROUTER_API_KEY` only — never hardcoded,
 * logged, or returned to the browser.
 *
 * Model IDs move around, so the transport discovers what is actually free at
 * request time. Set OPENROUTER_MODEL to pin a particular model.
 */
export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

/** Shown everywhere the pathway model is referenced. */
export const OPENROUTER_KEY_NAME = "OPENROUTER_API_KEY";

/**
 * Tried in order when OPENROUTER_MODEL is not set. The first model that is
 * still in the free catalogue wins. All of these are `:free` variants, so a
 * pathway build cannot silently start billing.
 */
export const OPENROUTER_PREFERRED_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "recursive/flint-v1.0:free",
] as const;

/** Fallback when the catalogue cannot be reached. */
export const OPENROUTER_DEFAULT_MODEL = OPENROUTER_PREFERRED_MODELS[0];

/** Returns the configured key, or null. The value is never exported. */
export function readOpenRouterKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key ? key : null;
}

/** Optional pin, used instead of free-model discovery. */
export function readOpenRouterModelOverride(): string | null {
  const model = process.env.OPENROUTER_MODEL?.trim();
  return model ? model : null;
}
