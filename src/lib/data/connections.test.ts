import { ConfigurationError } from "@/lib/errors";
import { classifyConnectionError } from "@/lib/data/connections";

describe("classifyConnectionError", () => {
  it("classifies malformed secrets as bad config", () => {
    expect(
      classifyConnectionError(new ConfigurationError("bad-secret", "broken")),
    ).toEqual({
      status: "bad_config",
      message: "The stored provider secret is malformed. Save the connection again.",
    });
  });

  it("maps auth, rate limit, and endpoint failures", () => {
    expect(classifyConnectionError(new Error("429 quota exceeded")).status).toBe(
      "rate_limited",
    );
    expect(classifyConnectionError(new Error("401 unauthorized")).status).toBe(
      "auth_failed",
    );
    expect(classifyConnectionError(new Error("fetch failed: ENOTFOUND")).status).toBe(
      "bad_base_url",
    );
  });
});
