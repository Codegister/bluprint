/**
 * Free OpenAI-compatible fallback providers.
 *
 * NVIDIA remains the first choice when its key is configured, but a single
 * provider is a single point of failure: a rate limit, a retired model or an
 * outage should not stop a study set halfway through. Each provider below is
 * only used when its own key is present, so a deployment that sets none keeps
 * exactly the old behaviour.
 *
 * The order is deliberate:
 *   1. Groq — fast, 1,000 requests/day on the free plan, and its agreement
 *      says inputs and outputs are not used for training.
 *   2. OpenRouter — a free model with a large context window, useful when the
 *      prompt is too long for Groq's free tokens-per-minute ceiling.
 *   3. Cloudflare Workers AI — 10,000 free Neurons/day, a last resort rather
 *      than a primary because that allowance is small.
 *
 * Data-protection note: free tiers differ in whether prompts are logged or
 * used to improve models. Read each provider's terms before sending student
 * material through it. Keys live only in the Convex environment; this module
 * never returns one to the browser or logs it.
 */

import {
  OPENROUTER_CHAT_URL,
  OPENROUTER_GENERATION_MODEL,
  readOpenRouterKey,
} from "./openrouterConfig";

export type FallbackProviderId = "groq" | "openrouter" | "cloudflare";

export type FallbackProvider = {
  id: FallbackProviderId;
  /** Human-readable name for server logs only. */
  label: string;
  url: string;
  model: string;
  apiKey: string;
  /** Provider-specific headers; never contains a secret. */
  headers?: Record<string, string>;
};

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

const CLOUDFLARE_DEFAULT_MODEL = "@cf/openai/gpt-oss-120b";

function envValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Groq's key, or an empty string when it is not configured. */
export function readGroqKey(): string {
  return envValue("GROQ_API_KEY");
}

/** The Groq model to use; override when Groq retires the default. */
export function groqModel(): string {
  return envValue("GROQ_GENERATION_MODEL") || GROQ_DEFAULT_MODEL;
}

/**
 * Cloudflare needs two values: the account id in the URL and an API token with
 * Workers AI permission. Either one missing leaves the provider disabled.
 */
export function readCloudflareCredentials(): {
  accountId: string;
  token: string;
} | null {
  const accountId = envValue("CLOUDFLARE_ACCOUNT_ID");
  const token = envValue("CLOUDFLARE_AI_API_TOKEN");
  return accountId && token ? { accountId, token } : null;
}

/** The Cloudflare model to use; override when the default is retired. */
export function cloudflareModel(): string {
  return envValue("CLOUDFLARE_GENERATION_MODEL") || CLOUDFLARE_DEFAULT_MODEL;
}

/**
 * Every configured fallback, in the order they should be tried.
 *
 * Presence of a key is the switch: there is no separate "enabled" flag to get
 * out of sync with the secret. OpenRouter is included here as well as its
 * tutor web-search role, because the same key can serve both.
 */
export function fallbackProviders(): FallbackProvider[] {
  const providers: FallbackProvider[] = [];

  const groqKey = readGroqKey();
  if (groqKey) {
    providers.push({
      id: "groq",
      label: "Groq",
      url: GROQ_CHAT_URL,
      model: groqModel(),
      apiKey: groqKey,
    });
  }

  const openRouterKey = readOpenRouterKey();
  if (openRouterKey) {
    providers.push({
      id: "openrouter",
      label: "OpenRouter",
      url: OPENROUTER_CHAT_URL,
      model: OPENROUTER_GENERATION_MODEL,
      apiKey: openRouterKey,
      headers: {
        "HTTP-Referer": "https://bluprint.study",
        "X-Title": "Bluprint",
      },
    });
  }

  const cloudflare = readCloudflareCredentials();
  if (cloudflare) {
    providers.push({
      id: "cloudflare",
      label: "Cloudflare Workers AI",
      url:
        "https://api.cloudflare.com/client/v4/accounts/" +
        `${encodeURIComponent(cloudflare.accountId)}/ai/v1/chat/completions`,
      model: cloudflareModel(),
      apiKey: cloudflare.token,
    });
  }

  return providers;
}

/** True when at least one fallback provider is configured. */
export function hasFallbackProvider(): boolean {
  return fallbackProviders().length > 0;
}
