type PublicEnv = {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  siteUrl: string;
};

export function getPublicEnv(): PublicEnv {
  const supabaseClientKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null;

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    supabaseAnonKey: supabaseClientKey,
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  };
}

export function hasSupabaseEnv() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getAllowedEmails() {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getEncryptionKeySecret() {
  return process.env.APP_ENCRYPTION_KEY ?? null;
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function isLocalDevAuthBypassEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    getPublicEnv().siteUrl.includes("localhost") &&
    Boolean(getSupabaseServiceRoleKey())
  );
}

export function isConfigured() {
  return hasSupabaseEnv() && Boolean(getEncryptionKeySecret()) && getAllowedEmails().length > 0;
}
