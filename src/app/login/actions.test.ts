import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClientMock,
  redirectMock,
  signInWithOtpMock,
} = vi.hoisted(() => {
  const redirect = vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  const signInWithOtp = vi.fn();

  return {
    redirectMock: redirect,
    signInWithOtpMock: signInWithOtp,
    createSupabaseServerClientMock: vi.fn(async () => ({
      auth: {
        signInWithOtp,
      },
    })),
  };
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/env", () => ({
  requirePublicSiteUrl: vi.fn(() => "http://localhost:3000"),
}));

import { requestMagicLink } from "@/app/login/actions";

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a normal magic link and redirects to the sent state", async () => {
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

  it("redirects with the provider error when sign-in fails", async () => {
    signInWithOtpMock.mockResolvedValue({
      error: new Error("Rate limit reached"),
    });

    const formData = new FormData();
    formData.set("email", "writer@example.com");

    await expect(requestMagicLink(formData)).rejects.toThrow(
      "REDIRECT:/login?reason=Rate%20limit%20reached",
    );
  });
});
