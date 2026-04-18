import { describe, expect, it, vi } from "vitest";
import { cleanupStaleGenerationLocks } from "@/lib/data/jobs";

describe("cleanupStaleGenerationLocks", () => {
  it("uses the live RPC argument name exposed by Supabase", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 3, error: null });
    const supabase = { rpc } as never;

    const cleaned = await cleanupStaleGenerationLocks(supabase, "10 minutes");

    expect(cleaned).toBe(3);
    expect(rpc).toHaveBeenCalledWith("cleanup_stale_generation_locks", {
      p_stale_before: "10 minutes",
    });
  });
});
