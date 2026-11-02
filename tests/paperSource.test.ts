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

  test("accepts AQA's newer file path and Save My Exams' file CDN", () => {
    expect(
      normalisePaperSourceUrl(
        "https://www.aqa.org.uk/files/paper-id/AQA-87021-QP-JUN25.PDF",
      ),
    ).toBe(
      "https://www.aqa.org.uk/files/paper-id/AQA-87021-QP-JUN25.PDF",
    );
    expect(
      normalisePaperSourceUrl(
        "https://cdn.sanity.io/files/p28bar15/green/paper.pdf?download=1",
      ),
    ).toBe(
      "https://cdn.sanity.io/files/p28bar15/green/paper.pdf?download=1",
    );
  });

  test("rejects paths outside the approved file directories", () => {
    expect(
      normalisePaperSourceUrl("https://www.aqa.org.uk/past-papers/paper.pdf"),
    ).toBeNull();
    expect(
      normalisePaperSourceUrl(
        "https://cdn.sanity.io/files/another-project/paper.pdf",
      ),
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
