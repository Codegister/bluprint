import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  cloudflareModel,
  fallbackProviders,
  groqModel,
  hasFallbackProvider,
} from "../src/convex/lib/fallbackConfig";

const ENV_NAMES = [
  "GROQ_API_KEY",
  "GROQ_GENERATION_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_GENERATION_MODEL",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_AI_API_TOKEN",
  "CLOUDFLARE_GENERATION_MODEL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const name of ENV_NAMES) delete process.env[name];
});

afterEach(() => {
  for (const name of ENV_NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("free fallback providers", () => {
  test("none are enabled without a key, so an unconfigured deployment is unchanged", () => {
    expect(fallbackProviders()).toEqual([]);
    expect(hasFallbackProvider()).toBe(false);
  });

  test("Groq uses its OpenAI-compatible endpoint and the checked default model", () => {
    process.env.GROQ_API_KEY = "gsk-test";
    const providers = fallbackProviders();
    expect(providers.map((provider) => provider.id)).toEqual(["groq"]);
    expect(providers[0]!.url).toBe(
      "https://api.groq.com/openai/v1/chat/completions",
    );
    expect(providers[0]!.model).toBe("openai/gpt-oss-120b");
    expect(groqModel()).toBe("openai/gpt-oss-120b");
  });

  test("an environment override replaces a retired Groq model", () => {
    process.env.GROQ_API_KEY = "gsk-test";
    process.env.GROQ_GENERATION_MODEL = "  openai/gpt-oss-20b  ";
    expect(fallbackProviders()[0]!.model).toBe("openai/gpt-oss-20b");
  });

  test("OpenRouter is available as a generation fallback and avoids NVIDIA's trial endpoints", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const providers = fallbackProviders();
    expect(providers.map((provider) => provider.id)).toEqual(["openrouter"]);
    expect(providers[0]!.url).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(providers[0]!.model.startsWith("nvidia/")).toBe(false);
    expect(providers[0]!.model.endsWith(":free")).toBe(true);
  });

  test("Cloudflare needs both the account id and a Workers AI token", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "abc123";
    expect(fallbackProviders()).toEqual([]);

    process.env.CLOUDFLARE_AI_API_TOKEN = "cf-token";
    const providers = fallbackProviders();
    expect(providers.map((provider) => provider.id)).toEqual(["cloudflare"]);
    expect(providers[0]!.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1/chat/completions",
    );
    expect(providers[0]!.model).toBe("@cf/openai/gpt-oss-120b");
    expect(cloudflareModel()).toBe("@cf/openai/gpt-oss-120b");
  });

  test("the order is Groq, then OpenRouter, then Cloudflare", () => {
    process.env.GROQ_API_KEY = "gsk-test";
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.CLOUDFLARE_ACCOUNT_ID = "abc123";
    process.env.CLOUDFLARE_AI_API_TOKEN = "cf-token";

    expect(fallbackProviders().map((provider) => provider.id)).toEqual([
      "groq",
      "openrouter",
      "cloudflare",
    ]);
    expect(hasFallbackProvider()).toBe(true);
  });
});
