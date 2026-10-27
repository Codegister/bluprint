import { describe, expect, test } from "bun:test";

import {
  isRetiredModel,
  liveModel,
  textModelCandidates,
  NVIDIA_TEXT_FALLBACK_MODELS,
} from "../src/convex/lib/nvidiaConfig";
import {
  HOUR_MS,
  buildLimit,
  checkAllowance,
} from "../src/convex/lib/buildLimits";
import {
  MAX_NOTE_CHARS,
  clipNote,
  noteLimitMessage,
  withinNoteLimit,
} from "../src/convex/lib/noteLimits";
import {
  ALERT_COOLDOWN_MS,
  INCIDENT_WINDOW_MS,
  isFatalKind,
  shouldAlert,
} from "../src/convex/lib/incidentRules";

const NOW = 1_700_000_000_000;

describe("current AI models", () => {
  test("the models NVIDIA retired are recognised, including from a stale env value", () => {
    expect(isRetiredModel("meta/llama-3.3-70b-instruct")).toBe(true);
    expect(isRetiredModel("  META/LLAMA-3.1-8B-INSTRUCT ")).toBe(true);
    expect(isRetiredModel("nvidia/nemotron-3.5-lightning-30b-a3b")).toBe(false);
  });

  test("a retired primary is replaced by a live fallback, not sent to the provider", () => {
    const chosen = liveModel(
      "meta/llama-3.3-70b-instruct",
      NVIDIA_TEXT_FALLBACK_MODELS,
    );
    expect(isRetiredModel(chosen)).toBe(false);
    expect(chosen).toBe(NVIDIA_TEXT_FALLBACK_MODELS[0]!);
  });

  test("the candidate chain never includes a retired model", () => {
    const candidates = textModelCandidates();
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((model) => !isRetiredModel(model))).toBe(true);
  });
});

describe("provider health alert", () => {
  const row = (kind: string, at = NOW - 1_000) => ({ kind, at });

  test("a dead model, a rejected key or an empty account alerts on the first failure", () => {
    for (const kind of ["model-unavailable", "auth", "no-credits"]) {
      expect(isFatalKind(kind)).toBe(true);
      expect(shouldAlert([row(kind)], NOW, undefined)).toBe(true);
    }
  });

  test("one rate limit is traffic, three are an outage", () => {
    expect(shouldAlert([row("rate-limit")], NOW, undefined)).toBe(false);
    expect(
      shouldAlert(
        [row("rate-limit"), row("rate-limit"), row("rate-limit")],
        NOW,
        undefined,
      ),
    ).toBe(true);
  });

  test("a failure between sweeps is still inside the next window", () => {
    const seventeenMinutesAgo = NOW - 17 * 60 * 1000;
    expect(INCIDENT_WINDOW_MS).toBeGreaterThan(17 * 60 * 1000);
    expect(
      shouldAlert([row("model-unavailable", seventeenMinutesAgo)], NOW, undefined),
    ).toBe(true);
  });

  test("one outage does not send a message on every sweep", () => {
    expect(
      shouldAlert(
        [row("model-unavailable")],
        NOW,
        NOW - ALERT_COOLDOWN_MS / 2,
      ),
    ).toBe(false);
  });

  test("incidents older than the window are ignored", () => {
    const stale = NOW - INCIDENT_WINDOW_MS - 1;
    expect(shouldAlert([row("model-unavailable", stale)], NOW, undefined)).toBe(false);
  });
});

describe("note length", () => {
  test("the advertised limit is exactly 20,000 characters", () => {
    expect(MAX_NOTE_CHARS).toBe(20_000);
    expect(withinNoteLimit("a".repeat(MAX_NOTE_CHARS))).toBe(true);
    expect(withinNoteLimit("a".repeat(MAX_NOTE_CHARS + 1))).toBe(false);
  });

  test("an oversized note gets a clear message with the overage", () => {
    const message = noteLimitMessage(30_800);
    expect(message).toContain("20,000");
    expect(message).toContain("10,800");
    expect(message).toContain("nothing has been built");
  });

  test("OCR text is clipped instead of losing the upload", () => {
    expect(clipNote("a".repeat(MAX_NOTE_CHARS + 500)).length).toBe(MAX_NOTE_CHARS);
  });
});

describe("build allowances", () => {
  test("a guest gets two new sets an hour, then a clear limit message", () => {
    const limit = buildLimit("set", "guest");
    expect(limit.perHour).toBe(2);

    const allowed = checkAllowance({
      kind: "set",
      identity: "guest",
      now: NOW,
      spent: [NOW - 10_000],
    });
    expect(allowed.allowed).toBe(true);

    const refused = checkAllowance({
      kind: "set",
      identity: "guest",
      now: NOW,
      spent: [NOW - 10_000, NOW - 5_000],
    });
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.message).toContain("build limit");
      expect(refused.message).toContain("Nothing was built");
    }
  });

  test("a signed-in member gets a larger allowance, not an unlimited one", () => {
    expect(buildLimit("set", "member").perHour).toBeGreaterThan(
      buildLimit("set", "guest").perHour,
    );
    const spent = Array.from({ length: 8 }, (_, index) => NOW - index * 1_000);
    const refused = checkAllowance({
      kind: "set",
      identity: "member",
      now: NOW,
      spent,
    });
    expect(refused.allowed).toBe(false);
  });

  test("builds from a previous hour do not count toward this hour", () => {
    const verdict = checkAllowance({
      kind: "set",
      identity: "guest",
      now: NOW,
      spent: [NOW - HOUR_MS - 1_000, NOW - HOUR_MS - 2_000],
    });
    expect(verdict.allowed).toBe(true);
  });
});
