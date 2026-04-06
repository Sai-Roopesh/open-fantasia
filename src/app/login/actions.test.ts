import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseAdminClientMock,
  createSupabaseServerClientMock,
  generateLinkMock,
  isAllowedEmailMock,
  isLocalDevAuthBypassEnabledMock,
  redirectMock,
  signInWithOtpMock,
} = vi.hoisted(() => {
  const redirect = vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  const signInWithOtp = vi.fn();
  const generateLink = vi.fn();

  return {
    redirectMock: redirect,
    signInWithOtpMock: signInWithOtp,
    generateLinkMock: generateLink,
    createSupabaseServerClientMock: vi.fn(async () => ({
      auth: {
        signInWithOtp,
      },
    })),
    createSupabaseAdminClientMock: vi.fn(() => ({
      auth: {
        admin: {
          generateLink,
        },
      },
    })),
    isLocalDevAuthBypassEnabledMock: vi.fn(() => true),
    isAllowedEmailMock: vi.fn(
      (email?: string | null) => email === "alice@example.com",
    ),
  };
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/env", () => ({
  hasSupabaseEnv: vi.fn(() => true),
  isLocalDevAuthBypassEnabled: isLocalDevAuthBypassEnabledMock,
  requirePublicSiteUrl: vi.fn(() => "http://localhost:3000"),
}));

vi.mock("@/lib/auth", () => ({
  isAllowedEmail: isAllowedEmailMock,
}));

import { requestMagicLink } from "@/app/login/actions";

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the local bypass immediately for allowlisted localhost emails", async () => {
    generateLinkMock.mockResolvedValue({
      error: null,
      data: {
        properties: {
          hashed_token: "local-token",
        },
      },
    });

    const formData = new FormData();
    formData.set("email", "alice@example.com");

    await expect(requestMagicLink(formData)).rejects.toThrow(
      "REDIRECT:http://localhost:3000/auth/callback?token_hash=local-token&type=magiclink",
    );
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it("falls back to the normal magic-link flow when bypass is unavailable", async () => {
    isLocalDevAuthBypassEnabledMock.mockReturnValue(false);
    signInWithOtpMock.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", "writer@example.com");

    await expect(requestMagicLink(formData)).rejects.toThrow(
      "REDIRECT:/login?sent=1",
    );
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "writer@example.com",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });
  });
});
