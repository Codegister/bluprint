"use node";

/**
 * Encryption for an NVIDIA key a user adds to their own account.
 *
 * This module is Node-only on purpose: Convex's default isolate runtime has no
 * `node:crypto`, so it must only be imported from a `"use node"` action file
 * (`nvidiaKeys.ts` and `ai.ts`). The deployment secret is `NVIDIA_KEY_SECRET`,
 * 32 bytes of hex. A missing or malformed secret makes `vaultReady()` false so
 * the UI can say "not set up yet" instead of failing halfway through a save.
 *
 * AES-256-GCM is used so the stored value is authenticated: a row edited in the
 * database decrypts to nothing rather than to a different key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;
const KEY_HEX_LENGTH = 64;

function masterKey(): Buffer {
  const raw = (process.env.NVIDIA_KEY_SECRET ?? "").trim();
  if (!new RegExp(`^[0-9a-fA-F]{${KEY_HEX_LENGTH}}$`).test(raw)) {
    throw new Error(
      `NVIDIA_KEY_SECRET must be 32 bytes of hex (${KEY_HEX_LENGTH} characters).`,
    );
  }
  return Buffer.from(raw, "hex");
}

/** Whether this deployment has the secret needed to store a user's key. */
export function vaultReady(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Seals a key for storage. A fresh random IV every time, so saving the same key
 * twice does not produce the same ciphertext.
 */
export function encryptKey(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const sealed = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    ENVELOPE_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    sealed.toString("base64"),
  ].join(":");
}

/** Opens a sealed key. Throws if the envelope or the secret is wrong. */
export function decryptKey(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(":");
  if (version !== ENVELOPE_VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error("unrecognised key envelope");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
