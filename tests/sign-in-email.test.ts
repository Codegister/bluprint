import { describe, expect, test } from "bun:test";
import { SIGN_IN_FROM, signInEmail } from "../src/convex/lib/signInEmail";

describe("sign-in code email", () => {
  test("is sent as BluPrint, not as the deployment's project slug", () => {
    const email = signInEmail({ code: "419316" });
    expect(email.from).toBe(SIGN_IN_FROM);
    expect(email.from).toContain("BluPrint");
    expect(email.from).not.toContain("fancy-eggs-return");
    expect(email.subject).toBe("Your BluPrint sign-in code");
    expect(email.text).not.toContain("fancy-eggs-return");
    expect(email.html).not.toContain("fancy-eggs-return");
  });

  test("the code and its expiry are in both bodies", () => {
    const email = signInEmail({ code: "993291", expiresInMinutes: 15 });
    expect(email.text).toContain("993291");
    expect(email.html).toContain("993291");
    expect(email.text).toContain("15 minutes");
    expect(email.html).toContain("15 minutes");
  });

  test("markup in the code cannot break out of the html", () => {
    const email = signInEmail({ code: "<b>&'" });
    expect(email.html).toContain("&lt;b&gt;&amp;&#39;");
    expect(email.html).not.toContain("<b>&'");
  });
});
