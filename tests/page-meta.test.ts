import { describe, expect, test } from "bun:test";

import { pageMetaFor } from "../src/lib/pageMeta";

describe("route metadata", () => {
  test("each route has its own title", () => {
    const titles = [
      pageMetaFor("/").title,
      pageMetaFor("/privacy").title,
      pageMetaFor("/terms").title,
      pageMetaFor("/today").title,
      pageMetaFor("/tutor").title,
      pageMetaFor("/sets/abc").title,
      pageMetaFor("/sets/abc/cards").title,
      pageMetaFor("/courses/abc").title,
    ];
    expect(new Set(titles).size).toBe(titles.length);
  });

  test("private, personal and tokenised routes are noindex", () => {
    for (const path of [
      "/auth",
      "/tutor",
      "/today",
      "/courses",
      "/sets/abc",
      "/share/abc",
    ]) {
      expect(pageMetaFor(path).noindex).toBe(true);
    }
  });

  test("the public pages stay indexable", () => {
    expect(pageMetaFor("/").noindex).toBe(false);
    expect(pageMetaFor("/privacy").noindex).toBe(false);
    expect(pageMetaFor("/terms").noindex).toBe(false);
  });

  test("metadata never includes a set id or a share token", () => {
    const meta = pageMetaFor("/sets/secret-set-id/cards");
    expect(meta.title).not.toContain("secret-set-id");
    expect(meta.description).not.toContain("secret-set-id");
    expect(pageMetaFor("/share/token-value-123").title).not.toContain(
      "token-value-123",
    );
  });
});
