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
        actions.throwIfFailed({ ok: true } as Response),
      ).resolves.toBeUndefined();
    });

    it("throws a malformed-response error when json parsing fails", async () => {
      const response = {
        ok: false,
        json: async () => {
          throw new Error("Parse err");
        },
      } as unknown as Response;
      await expect(actions.throwIfFailed(response)).rejects.toThrow(
        "Action response was malformed.",
      );
    });

    it("throws server error message if returned", async () => {
      const response = {
        ok: false,
        json: async () => ({ error: "Server said no." }),
      } as unknown as Response;
      await expect(actions.throwIfFailed(response)).rejects.toThrow(
        "Server said no.",
      );
    });
  });

  describe("regenerateTurn", () => {
    it("calls correctly and throws on fail", async () => {
      mockFetchResponse(false, { error: "Regenerate failed." });
      await expect(
        actions.regenerateTurn("t1", "b1", "head1"),
      ).rejects.toThrow("Regenerate failed.");
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: "b1", expectedHeadTurnId: "head1" }),
      });
    });

    it("resolves on success", async () => {
      mockFetchResponse(true);
      await expect(
        actions.regenerateTurn("t1", "b1", "head1"),
      ).resolves.toBeUndefined();
    });
  });

  describe("createBranch", () => {
    it("calls correctly with defaulting makeActive", async () => {
      mockFetchResponse(true);
      await actions.createBranch("t1", { sourceTurnId: "turn1", name: "bname" });
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTurnId: "turn1",
          name: "bname",
          makeActive: true,
        }),
      });
    });
  });

  describe("rewindTurn", () => {
    it("posts to the rewind route without an unused request body", async () => {
      mockFetchResponse(true);
      await expect(actions.rewindTurn("t1", "turn1")).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/turns/turn1/rewind", {
        method: "POST",
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
