import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { requireEncryptionKeyHex } from "@/lib/env";
import { ConfigurationError } from "@/lib/errors";

function deriveKey() {
  return Buffer.from(requireEncryptionKeyHex(), "hex");
}

export function encryptSecret(value: string) {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string | null) {
  if (!value) return "";
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new ConfigurationError(
      "malformed_secret",
      "Stored provider secret is malformed.",
    );
  }

  const key = deriveKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
