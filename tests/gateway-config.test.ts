import { describe, expect, test } from "bun:test";

import { chatCompletionsUrl } from "../src/convex/lib/gatewayConfig";

const DIRECT = "https://integrate.api.nvidia.com/v1/chat/completions";

describe("chatCompletionsUrl", () => {
  test("posts straight to the provider when no gateway is configured", () => {
    expect(chatCompletionsUrl(undefined, DIRECT)).toBe(DIRECT);
    expect(chatCompletionsUrl(null, DIRECT)).toBe(DIRECT);
    expect(chatCompletionsUrl("", DIRECT)).toBe(DIRECT);
    expect(chatCompletionsUrl("   ", DIRECT)).toBe(DIRECT);
  });

  test("completes a loopback base URL the way the gateway serves it", () => {
    expect(chatCompletionsUrl("http://127.0.0.1:8080", DIRECT)).toBe(
      "http://127.0.0.1:8080/v1/chat/completions",
    );
    expect(chatCompletionsUrl("http://127.0.0.1:8080/", DIRECT)).toBe(
      "http://127.0.0.1:8080/v1/chat/completions",
    );
    expect(chatCompletionsUrl("http://127.0.0.1:8080/v1", DIRECT)).toBe(
      "http://127.0.0.1:8080/v1/chat/completions",
    );
    expect(
      chatCompletionsUrl("http://127.0.0.1:8080/v1/chat/completions", DIRECT),
    ).toBe("http://127.0.0.1:8080/v1/chat/completions");
  });

  test("assumes http for a bare host and port", () => {
    expect(chatCompletionsUrl("127.0.0.1:8080", DIRECT)).toBe(
      "http://127.0.0.1:8080/v1/chat/completions",
    );
  });
});
