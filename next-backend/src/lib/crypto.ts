import crypto from "node:crypto";
import { config } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (!cachedKey) {
    cachedKey = crypto.scryptSync(config.JWT_SECRET, "nextdor-field-encryption-v1", 32);
  }
  return cachedKey;
}

/**
 * Encrypts sensitive third-party secrets (e.g. wcConsumerSecret) using AES-256-GCM
 * before storing them at rest in PostgreSQL.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted secret from PostgreSQL.
 * Gracefully returns plaintext values that were stored before encryption was enabled.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;

  try {
    const payload = stored.slice(PREFIX.length);
    const [ivHex, authTagHex, cipherHex] = payload.split(":");
    if (!ivHex || !authTagHex || !cipherHex) return null;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(cipherHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
