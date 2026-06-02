import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionTokenMock } = vi.hoisted(() => ({
  verifySessionTokenMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  verifySessionToken: verifySessionTokenMock,
}));

import { config, proxy } from "@/proxy";
import { SESSION_COOKIE } from "@/lib/auth-config";

function requestWithSession(url: string, token?: string) {
  const request = new NextRequest(url);
  if (token) {
    request.cookies.set(SESSION_COOKIE, token);
  }
  return request;
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the Next 16 proxy matcher wired to app and login routes", () => {
    expect(config.matcher).toEqual(["/app/:path*", "/login"]);
  });

  it("redirects unauthenticated app requests to login", async () => {
    verifySessionTokenMock.mockResolvedValue(false);

    const response = await proxy(requestWithSession("http://localhost/app"));

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?reason=signin",
    );
  });

  it("redirects authenticated users away from login", async () => {
    verifySessionTokenMock.mockResolvedValue(true);

    const response = await proxy(
      requestWithSession("http://localhost/login", "valid-token"),
    );

    expect(response.headers.get("location")).toBe("http://localhost/app");
  });

  it("lets authenticated users through to app routes", async () => {
    verifySessionTokenMock.mockResolvedValue(true);

    const response = await proxy(
      requestWithSession("http://localhost/app", "valid-token"),
    );

    expect(response.headers.get("location")).toBeNull();
  });
});
