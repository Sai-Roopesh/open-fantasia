import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookieSetMock,
  redirectMock,
  checkCredentialsMock,
  createSessionTokenMock,
} = vi.hoisted(() => ({
  cookieSetMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  checkCredentialsMock: vi.fn(),
  createSessionTokenMock: vi.fn(async () => "signed-session-token"),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSetMock })),
}));

vi.mock("@/lib/session", () => ({
  checkCredentials: checkCredentialsMock,
  createSessionToken: createSessionTokenMock,
}));

import { signIn } from "@/app/login/actions";
import { SESSION_COOKIE } from "@/lib/auth-config";

function credentials(username: string, password: string) {
  const formData = new FormData();
  formData.set("username", username);
  formData.set("password", password);
  return formData;
}

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the session cookie and redirects to the app on valid credentials", async () => {
    checkCredentialsMock.mockReturnValue(true);

    await expect(signIn(credentials("roops21", "chinnu21$"))).rejects.toThrow(
      "REDIRECT:/app",
    );

    expect(checkCredentialsMock).toHaveBeenCalledWith("roops21", "chinnu21$");
    expect(cookieSetMock).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "signed-session-token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it("redirects back with an invalid reason on bad credentials", async () => {
    checkCredentialsMock.mockReturnValue(false);

    await expect(signIn(credentials("roops21", "wrong"))).rejects.toThrow(
      "REDIRECT:/login?reason=invalid",
    );
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("redirects back with an invalid reason when fields are missing", async () => {
    await expect(signIn(credentials("", ""))).rejects.toThrow(
      "REDIRECT:/login?reason=invalid",
    );
    expect(checkCredentialsMock).not.toHaveBeenCalled();
  });
});
