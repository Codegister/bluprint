import { describe, expect, test } from "bun:test";

import { normalisePaperSourceUrl } from "../src/convex/lib/paperSource";

describe("paper source URLs", () => {
  test("accepts a publisher PDF and drops its fragment", () => {
    expect(
      normalisePaperSourceUrl(
        "https://pmt.physicsandmathstutor.com/download/paper.pdf#page=2",
      ),
    ).toBe(
      "https://pmt.physicsandmathstutor.com/download/paper.pdf",
    );
  });

  test("rejects non-https, non-PDF and unknown hosts", () => {
    expect(
      normalisePaperSourceUrl(
        "http://pmt.physicsandmathstutor.com/download/paper.pdf",
      ),
    ).toBeNull();
    expect(
      normalisePaperSourceUrl(
        "https://pmt.physicsandmathstutor.com/download/paper.html",
      ),
    ).toBeNull();
    expect(
      normalisePaperSourceUrl("https://example.com/download/paper.pdf"),
    ).toBeNull();
  });

  test("rejects credentials and explicit ports", () => {
    expect(
      normalisePaperSourceUrl(
        "https://user:pass@pmt.physicsandmathstutor.com/paper.pdf",
      ),
    ).toBeNull();
    expect(
      normalisePaperSourceUrl(
        "https://pmt.physicsandmathstutor.com:8443/paper.pdf",
      ),
    ).toBeNull();
  });
});
