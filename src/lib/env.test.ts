import {
  getAllowedEmails,
  getPublicEnv,
  getCronSecret,
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
  hasSupabaseEnv,
  requireCronSecret,
  requirePublicSiteUrl,
  requirePublicEnv,
  requireSupabaseServiceRoleKey,
  requireSupabasePublicEnv,
} from "@/lib/env";

describe("env helpers", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reads the current Supabase publishable key contract", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

    expect(getSupabasePublicEnv()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    });
    expect(getPublicEnv()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
      siteUrl: "http://localhost:3000",
    });
    expect(hasSupabaseEnv()).toBe(true);
    expect(requireSupabasePublicEnv()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    });
    expect(requirePublicEnv()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
      siteUrl: "http://localhost:3000",
    });
  });

  it("normalizes and filters allowed emails", () => {
    process.env.ALLOWED_EMAILS = " Alice@example.com, ,bob@example.com ";

    expect(getAllowedEmails()).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("requires the service role key and cron secret explicitly", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.CRON_SECRET = "cron-secret";

    expect(getSupabaseServiceRoleKey()).toBe("service-role");
    expect(requireSupabaseServiceRoleKey()).toBe("service-role");
    expect(getCronSecret()).toBe("cron-secret");
    expect(requireCronSecret()).toBe("cron-secret");

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.CRON_SECRET;

    expect(() => requireSupabaseServiceRoleKey()).toThrow(
      "Missing Supabase service role key",
    );
    expect(() => requireCronSecret()).toThrow("Missing CRON_SECRET");
  });

  it("only falls back to localhost siteUrl during development", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    };

    expect(getPublicEnv().siteUrl).toBe("http://localhost:3000");
    expect(requirePublicSiteUrl()).toBe("http://localhost:3000");

    process.env = {
      ...process.env,
      NODE_ENV: "production",
    };

    expect(getPublicEnv().siteUrl).toBeNull();
    expect(requireSupabasePublicEnv()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    });
    expect(() => requirePublicSiteUrl()).toThrow("Missing public site URL");
  });

  it("resolves the current Vercel host when no explicit site URL is configured", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_URL: "open-fantasia-preview.vercel.app",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    };

    expect(getPublicEnv().siteUrl).toBe("https://open-fantasia-preview.vercel.app");
    expect(requirePublicSiteUrl()).toBe("https://open-fantasia-preview.vercel.app");
  });
});
