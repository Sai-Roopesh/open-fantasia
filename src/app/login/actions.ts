"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { checkCredentials, createSessionToken } from "@/lib/session";
import { loginCredentialsSchema } from "@/lib/validation";

export async function signIn(formData: FormData) {
  const parsed = loginCredentialsSchema.safeParse({
    username: String(formData.get("username") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    redirect("/login?reason=invalid");
  }

  if (!checkCredentials(parsed.data.username, parsed.data.password)) {
    redirect("/login?reason=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/app");
}
