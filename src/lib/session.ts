/**
 * Stateless signed-cookie session for the single-user login.
 *
 * Runtime-agnostic: uses only Web Crypto (`crypto.subtle`) and string ops, so the
 * exact same module runs in the Next proxy (edge runtime, `src/proxy.ts`) and in
 * server actions / route handlers (node runtime). No Node `crypto` import.
 *
 * Because there is exactly one user, the signed payload is a constant — the token
 * is an HMAC over that constant with the session secret. An attacker cannot forge
 * it without the secret, and verification is a timing-safe compare.
 */
import {
  AUTH_PASSWORD,
  AUTH_USERNAME,
  getSessionSecret,
} from "@/lib/auth-config";

const encoder = new TextEncoder();
const SESSION_PAYLOAD = "open-fantasia.session.v1";

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Constant-time string comparison. Returns false on length mismatch. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bufferToHex(signature);
}

/** The opaque session token to store in the cookie on successful login. */
export async function createSessionToken(): Promise<string> {
  return hmacHex(getSessionSecret(), SESSION_PAYLOAD);
}

/** True only if `token` is a valid, untampered session token. */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) {
    return false;
  }
  const expected = await createSessionToken();
  return timingSafeEqual(token, expected);
}

/** Validates a username/password pair against the hardcoded credential. */
export function checkCredentials(username: string, password: string): boolean {
  // Evaluate both halves so the work is independent of which one is wrong.
  const userOk = timingSafeEqual(username, AUTH_USERNAME);
  const passOk = timingSafeEqual(password, AUTH_PASSWORD);
  return userOk && passOk;
}
