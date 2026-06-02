type SupabasePublicEnv = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
};

const ENCRYPTION_KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null,
  };
}

export function requireSupabasePublicEnv() {
  const env = getSupabasePublicEnv();
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new Error(
      "Missing public Supabase environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return env as {
    supabaseUrl: string;
    supabasePublishableKey: string;
  };
}

export function hasSupabaseEnv() {
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicEnv();
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getEncryptionKeySecret() {
  return process.env.APP_ENCRYPTION_KEY ?? null;
}

export function requireEncryptionKeyHex() {
  const secret = getEncryptionKeySecret()?.trim() ?? "";
  if (!ENCRYPTION_KEY_HEX_RE.test(secret)) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be a 64-character hex string (32 random bytes).",
    );
  }

  return secret.toLowerCase();
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function requireSupabaseServiceRoleKey() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return serviceRoleKey;
}

export function getCronSecret() {
  return process.env.CRON_SECRET ?? null;
}

export function requireCronSecret() {
  const secret = getCronSecret();
  if (!secret) {
    throw new Error("Missing CRON_SECRET.");
  }
  return secret;
}

export function isConfigured() {
  return hasSupabaseEnv() && Boolean(getEncryptionKeySecret());
}
