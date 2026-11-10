import { describe, expect, test } from "bun:test";
import { isPreviewHostname } from "../src/lib/previewHost";

describe("preview hostname gate", () => {
  test("does not load preview tooling on the production Pages host", () => {
    expect(isPreviewHostname("codegister.github.io")).toBe(false);
    expect(isPreviewHostname("bluprint.example.com")).toBe(false);
  });

  test("loads preview tooling on local and hosted previews", () => {
    expect(isPreviewHostname("localhost")).toBe(true);
    expect(isPreviewHostname("127.0.0.1")).toBe(true);
    expect(isPreviewHostname("abc.vly.sh")).toBe(true);
    expect(isPreviewHostname("pv-a3be.style.dev")).toBe(true);
  });
});
