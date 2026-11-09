import { describe, expect, test } from "bun:test";
import { hostOf, safeExternalUrl } from "../src/lib/safeExternalUrl";

describe("safeExternalUrl", () => {
  test("allows normal web links", () => {
    expect(safeExternalUrl("https://www.bbc.co.uk/bitesize")).toBe(
      "https://www.bbc.co.uk/bitesize",
    );
    expect(safeExternalUrl("http://example.com/a?b=1")).toBe(
      "http://example.com/a?b=1",
    );
  });

  test("rejects script and data schemes", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
  });

  test("rejects malformed and relative links", () => {
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl("//example.com")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
  });
});

describe("hostOf", () => {
  test("strips www and leaves invalid text readable", () => {
    expect(hostOf("https://www.example.com/path")).toBe("example.com");
    expect(hostOf("not a url")).toBe("not a url");
  });
});
