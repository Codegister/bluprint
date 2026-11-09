import { describe, expect, test } from "bun:test";
import { readLimitedBody } from "../src/convex/lib/readLimitedBody";

describe("readLimitedBody", () => {
  test("returns a body within the cap", async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const buffer = await readLimitedBody(new Response(body), 4);
    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3, 4]);
  });

  test("rejects a body that exceeds the cap even without Content-Length", async () => {
    const body = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(readLimitedBody(new Response(body), 4)).rejects.toThrow(
      "Response body is too large.",
    );
  });
});
