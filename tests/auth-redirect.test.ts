import { describe, expect, test } from "bun:test";

import { guestKeepWorkHref, safeReturnTo } from "../src/lib/authRedirect";

describe("guest sign-up destination", () => {
  test("never points at the missing /sets route", () => {
    expect(guestKeepWorkHref("/tutor")).toBe(
      "/auth?link=1&returnTo=%2Ftutor%23sets",
    );
    expect(guestKeepWorkHref("/today")).not.toContain("%2Fsets");
  });

  test("keeps a guest on the set they were reading", () => {
    const setId = "j57abcdefghijklmnopqrstuvwx";
    expect(guestKeepWorkHref(`/sets/${setId}`)).toBe(
      `/auth?link=1&returnTo=${encodeURIComponent(`/sets/${setId}`)}`,
    );
  });

  test("auth return paths stay on this origin", () => {
    expect(safeReturnTo("//evil.example")).toBe("/tutor");
    expect(safeReturnTo("https://evil.example")).toBe("/tutor");
    expect(safeReturnTo("/tutor#sets")).toBe("/tutor#sets");
  });
});
