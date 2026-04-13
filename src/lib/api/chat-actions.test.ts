import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as actions from "./chat-actions";

describe("chat-actions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetchResponse(ok: boolean, body: unknown = {}) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: ok ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  describe("throwIfFailed", () => {
    it("returns when ok is true", async () => {
      await expect(
        actions.throwIfFailed({ ok: true } as Response, "Fallback"),
      ).resolves.toBeUndefined();
    });

    it("throws fallback when json parsing fails", async () => {
      const response = {
        ok: false,
        json: async () => {
          throw new Error("Parse err");
        },
      } as unknown as Response;
      await expect(actions.throwIfFailed(response, "Fallback")).rejects.toThrow("Fallback");
    });

    it("throws server error message if returned", async () => {
      const response = {
        ok: false,
        json: async () => ({ error: "Server said no." }),
      } as unknown as Response;
      await expect(actions.throwIfFailed(response, "Fallback")).rejects.toThrow(
        "Server said no.",
      );
    });
  });

  describe("regenerateCheckpoint", () => {
    it("calls correctly and throws on fail", async () => {
      mockFetchResponse(false);
      await expect(actions.regenerateCheckpoint("t1", "c1")).rejects.toThrow(
        "Regenerate failed.",
      );
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId: "c1" }),
      });
    });

    it("resolves on success", async () => {
      mockFetchResponse(true);
      await expect(actions.regenerateCheckpoint("t1", "c1")).resolves.toBeUndefined();
    });
  });

  describe("createBranch", () => {
    it("calls correctly with defaulting makeActive", async () => {
      mockFetchResponse(true);
      await actions.createBranch("t1", { checkpointId: "c1", name: "bname" });
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: "c1",
          name: "bname",
          makeActive: true,
        }),
      });
    });
  });

  describe("triggerStarter", () => {
    it("calls correctly", async () => {
      mockFetchResponse(true);
      await actions.triggerStarter("t1", "Let's begin!");
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/starter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starter: "Let's begin!" }),
      });
    });
  });
});
