type SupabasePublicEnv = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
};

type PublicEnv = SupabasePublicEnv & {
  siteUrl: string | null;
};

function normalizeUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function getResolvedSiteUrl() {
  const explicitSiteUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicitSiteUrl) {
    return explicitSiteUrl;
  }

  if (process.env.VERCEL === "1") {
    if (process.env.VERCEL_ENV === "production") {
      return (
        normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
        normalizeUrl(process.env.VERCEL_URL)
      );
    }

    return (
      normalizeUrl(process.env.VERCEL_BRANCH_URL) ??
      normalizeUrl(process.env.VERCEL_URL) ??
      normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    );
  }

  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : null;
}

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

export function getPublicEnv(): PublicEnv {
  const siteUrl = getResolvedSiteUrl();

  return {
    ...getSupabasePublicEnv(),
    siteUrl,
  };
}

export function requirePublicSiteUrl() {
  const siteUrl = getResolvedSiteUrl();
  if (!siteUrl) {
    throw new Error(
      "Missing public site URL. Set NEXT_PUBLIC_SITE_URL outside localhost development or enable Vercel system environment variables.",
    );
  }
  return siteUrl;
}

export function requirePublicEnv() {
  return {
    ...requireSupabasePublicEnv(),
    siteUrl: requirePublicSiteUrl(),
  };
}

export function hasSupabaseEnv() {
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicEnv();
  return Boolean(supabaseUrl && supabasePublishableKey);
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

export function getCronSecret() {
  return process.env.CRON_SECRET ?? null;
}

export function isLocalDevAuthBypassEnabled() {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  if (process.env.ENABLE_LOCAL_DEV_AUTH_BYPASS !== "true") {
    return false;
  }

  const hostname = (() => {
    try {
      return new URL(getPublicEnv().siteUrl ?? "").hostname;
    } catch {
      return "";
    }
  })();

  return (
    (hostname === "localhost" || hostname === "127.0.0.1") &&
    Boolean(getSupabaseServiceRoleKey())
  );
}

export function isConfigured() {
  return hasSupabaseEnv() && Boolean(getEncryptionKeySecret()) && getAllowedEmails().length > 0;
}
