import { describe, expect, test } from "bun:test";
import { passwordRefusal } from "../src/convex/lib/passwordRefusal";
import {
  SIGN_IN_FROM,
  passwordResetEmail,
  signInEmail,
} from "../src/convex/lib/signInEmail";
import { readableError } from "../src/lib/errors";

describe("password reset code email", () => {
  test("reads as a reset, not as a sign-in, and still comes from BluPrint", () => {
    const email = passwordResetEmail({ code: "730142" });
    const signIn = signInEmail({ code: "730142" });
    expect(email.from).toBe(SIGN_IN_FROM);
    expect(email.subject).toBe("Your BluPrint password reset code");
    expect(email.subject).not.toBe(signIn.subject);
    expect(email.html).not.toContain("sign-in code");
    expect(email.text).toContain("password reset code");
  });

  test("carries the code and its expiry in both bodies", () => {
    const email = passwordResetEmail({ code: "551208", expiresInMinutes: 15 });
    expect(email.text).toContain("551208");
    expect(email.html).toContain("551208");
    expect(email.text).toContain("15 minutes");
    expect(email.html).toContain("15 minutes");
  });

  test("says the old password is unchanged when the mail was not asked for", () => {
    const email = passwordResetEmail({ code: "000111" });
    expect(email.text).toContain("has not changed");
    expect(email.html).toContain("has not changed");
  });

  test("markup in the code cannot break out of the html", () => {
    const email = passwordResetEmail({ code: "<b>&'" });
    expect(email.html).toContain("&lt;b&gt;&amp;&#39;");
    expect(email.html).not.toContain("<b>&'");
  });
});

describe("what a password failure says", () => {
  test("a wrong reset code is not described as a wrong password", () => {
    const sentence = passwordRefusal(new Error("Invalid code"), "reset-verification");
    expect(sentence).toBe("That code didn't work. Check it, or request a new one.");
    expect(sentence).not.toContain("don't match an account");
  });

  test("a reset for an address with no password says so", () => {
    expect(passwordRefusal(new Error("InvalidAccountId"), "reset")).toContain(
      "doesn't have a password to reset",
    );
  });

  test("a library lock names the reset code, not the password", () => {
    expect(passwordRefusal(new Error("TooManyFailedAttempts"), "reset")).toContain(
      "reset code",
    );
    expect(passwordRefusal(new Error("TooManyFailedAttempts"), "signIn")).toContain(
      "password",
    );
  });

  test("a send-gate refusal keeps the seconds the student must wait", () => {
    const sentence = "A code was requested recently. Try again in 42s.";
    expect(passwordRefusal(new Error(sentence), "reset")).toBe(sentence);
  });

  test("an unreadable provider error becomes a reset sentence", () => {
    expect(passwordRefusal(new Error("HTTP 502"), "reset")).toBe(
      "We couldn't send a reset code. Try again in a minute, or email yourself a sign-in code.",
    );
  });

  test("setting a password when one exists points at the reset", () => {
    expect(passwordRefusal(new Error("Account already exists"), "signUp")).toContain(
      "reset it",
    );
  });
});

describe("the sign-in page shows the reset sentences", () => {
  const fallback = "That code didn't work. Check it, or request a new one.";

  test("the server's reset sentence reaches the page", () => {
    expect(
      readableError(
        new Error(
          "Uncaught Error: Too many tries. Wait a few minutes, then request a new reset code.",
        ),
        fallback,
      ),
    ).toBe("Too many tries. Wait a few minutes, then request a new reset code.");
  });

  test("a reset sentence is not mistaken for an internal error", () => {
    expect(
      readableError(
        new Error("That address doesn't have a password to reset. Sign in with an emailed code instead."),
        fallback,
      ),
    ).toContain("doesn't have a password to reset");
  });
});
