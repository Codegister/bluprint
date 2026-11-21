import { describe, expect, test } from "bun:test";
import { passwordRefusal } from "../src/convex/lib/passwordRefusal";
import { readableError } from "../src/lib/errors";

describe("changing a password from a signed-in session", () => {
  test("a wrong current password says which field is wrong", () => {
    const sentence = passwordRefusal(new Error("InvalidSecret"), "change");
    expect(sentence).toContain("current password doesn't match");
    expect(sentence).toContain("Forgot your password?");
    // The sign-in sentence would send them looking at the wrong thing.
    expect(sentence).not.toContain("email and password don't match");
  });

  test("an account that has no password is named as such", () => {
    expect(passwordRefusal(new Error("InvalidAccountId"), "change")).toBe(
      "This account doesn't have a password to change yet.",
    );
  });

  test("the five-an-hour counter still applies", () => {
    expect(passwordRefusal(new Error("TooManyFailedAttempts"), "change")).toBe(
      "Too many tries. Wait a few minutes, then try again.",
    );
  });

  test("an unexplained failure does not leak the library's message", () => {
    const sentence = passwordRefusal(
      new Error("Cannot modify account with ID sam@school.uk because it does not exist"),
      "change",
    );
    expect(sentence).toBe("We couldn't change that password. Try again in a moment.");
    expect(sentence).not.toContain("sam@school.uk");
  });
});

describe("the dialog shows those sentences", () => {
  const fallback =
    "Could not change your password. Check your current password, then try again.";

  test("the server's sentence reaches the dialog instead of the fallback", () => {
    expect(
      readableError(
        new Error(
          'That current password doesn\'t match. Check it, or use "Forgot your password?" on the sign-in page.',
        ),
        fallback,
      ),
    ).toContain("current password doesn't match");
  });

  test("the length rule is a sentence, not an engine error", () => {
    expect(
      readableError(
        new Error("Choose a password with at least 8 characters."),
        fallback,
      ),
    ).toBe("Choose a password with at least 8 characters.");
  });

  test("an engine message keeps the generic fallback", () => {
    expect(
      readableError(
        new Error("Uncaught Error: ArgumentValidationError Path: .newPassword"),
        fallback,
      ),
    ).toBe(fallback);
  });
});
