const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

/**
 * Detects IPv6 private/reserved addresses that should be blocked for SSRF
 * protection. Covers:
 *   - `::1` (loopback)
 *   - `fc00::/7` (Unique Local Addresses — fd00::/8 and fc00::/8)
 *   - `fe80::/10` (link-local)
 *   - `::ffff:x.x.x.x` (IPv4-mapped IPv6 — delegates to IPv4 checks)
 */
function isPrivateIpv6(hostname: string) {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    h === "::1" ||
    h.startsWith("fd") || // fc00::/7 ULA (fd prefix)
    h.startsWith("fc") || // fc00::/7 ULA (fc prefix)
    h.startsWith("fe80") || // link-local fe80::/10
    h.startsWith("::ffff:") // IPv4-mapped IPv6
  );
}

function isPrivateIp(hostname: string) {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;

  // Check IPv6 private ranges before the IPv4 regex branch.
  if (isPrivateIpv6(hostname)) return true;

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const [, a, b] = ipv4Match.map(Number);

  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b! >= 16 && b! <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 169 && b === 254) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 0.0.0.0
  if (a === 0) return true;

  return false;
}

/**
 * Validates a user-supplied Ollama base URL for SSRF safety: must be http(s)
 * and must not resolve to a private/internal address. Pure — no catalog or I/O
 * dependency, so it lives in the utility layer and is safe for the data layer
 * to call directly.
 */
export function validateOllamaBaseUrl(baseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      "Invalid Ollama base URL. Provide a valid URL like http://my-ollama-host:11434.",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Ollama base URL must use http:// or https://.");
  }

  if (isPrivateIp(parsed.hostname)) {
    throw new Error("Ollama base URL must not point to a private or internal address.");
  }
}
