import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { ConfigurationError } from "@/lib/errors";

describe("crypto helpers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = "test-encryption-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("round-trips encrypted secrets", () => {
    const encrypted = encryptSecret("hello-world");
    expect(encrypted).not.toBe("hello-world");
    expect(decryptSecret(encrypted)).toBe("hello-world");
  });

  it("throws a configuration error for malformed stored secrets", () => {
    expect(() => decryptSecret("not-a-valid-secret")).toThrow(ConfigurationError);
  });
});
