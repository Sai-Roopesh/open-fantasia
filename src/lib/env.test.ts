import { afterEach, describe, expect, it } from "vitest";
import {
  getCronSecret,
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
  hasSupabaseEnv,
  isConfigured,
  requireCronSecret,
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

    expect(getSupabasePublicEnv()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    });
    expect(hasSupabaseEnv()).toBe(true);
    expect(requireSupabasePublicEnv()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    });
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

  it("reports configured only with Supabase env and an encryption key", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    };
    delete process.env.APP_ENCRYPTION_KEY;
    expect(isConfigured()).toBe(false);

    process.env.APP_ENCRYPTION_KEY = "a".repeat(64);
    expect(isConfigured()).toBe(true);
  });
});
