import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * A six-digit code, shared by the sign-in code and the password-reset code.
 *
 * Six digits are only safe here because a code expires in fifteen minutes and
 * Convex Auth allows five wrong guesses an hour against an address; that is the
 * budget these digits are drawn against.
 */
export function sixDigitCode(): string {
  const random: RandomReader = {
    read(bytes: Uint8Array) {
      crypto.getRandomValues(bytes);
    },
  };
  return generateRandomString(random, "0123456789", 6);
}
