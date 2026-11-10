import { describe, expect, test } from "bun:test";

import {
  BUILD_DEFAULTS,
  BUILD_MAX,
  BUILD_MIN,
  clampBuildCount,
} from "../src/convex/lib/buildDefaults";

describe("build count requests", () => {
  test("uses the fallback when a caller omits a count", () => {
    expect(clampBuildCount(undefined, BUILD_DEFAULTS.cards)).toBe(
      BUILD_DEFAULTS.cards,
    );
  });

  test("keeps explicit totals inside the published range", () => {
    expect(clampBuildCount(0, 10)).toBe(BUILD_MIN);
    expect(clampBuildCount(-4, 10)).toBe(BUILD_MIN);
    expect(clampBuildCount(BUILD_MAX + 1, 10)).toBe(BUILD_MAX);
  });

  test("rounds a decimal request and falls back for a non-number", () => {
    expect(clampBuildCount(7.6, 10)).toBe(8);
    expect(clampBuildCount(Number.NaN, 10)).toBe(10);
  });
});
