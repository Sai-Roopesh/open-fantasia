import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock, getUserMock } = vi.hoisted(() => {
  const getUser = vi.fn();
  return {
    getUserMock: getUser,
    createServerClientMock: vi.fn(() => ({
      auth: {
        getUser,
      },
    })),
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/env", () => ({
  hasSupabaseEnv: vi.fn(() => true),
  requireSupabasePublicEnv: vi.fn(() => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_key",
  })),
}));

vi.mock("@/lib/auth", () => ({
  isAllowedEmail: vi.fn((email?: string | null) => email === "allowed@example.com"),
}));

import { config, proxy } from "@/proxy";

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the Next 16 proxy matcher wired to app and login routes", () => {
    expect(config.matcher).toEqual(["/app/:path*", "/login"]);
  });

  it("redirects unauthenticated app requests to login", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const response = await proxy(new NextRequest("http://localhost/app"));

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?reason=signin",
    );
  });

  it("redirects authenticated allowed users away from login", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          email: "allowed@example.com",
        },
      },
    });

    const response = await proxy(new NextRequest("http://localhost/login"));

    expect(response.headers.get("location")).toBe("http://localhost/app");
  });
});
