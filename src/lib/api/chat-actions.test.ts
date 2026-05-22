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

  describe("rewriteLatestTurn", () => {
    it("calls correctly and throws on fail", async () => {
      mockFetchResponse(false, { error: "Regenerate failed." });
      await expect(
        actions.rewriteLatestTurn("t1", {
          branchId: "b1",
          expectedHeadTurnId: "head1",
          mode: "regenerate",
        }),
      ).rejects.toThrow("Regenerate failed.");
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: "b1",
          expectedHeadTurnId: "head1",
          mode: "regenerate",
        }),
      });
    });

    it("resolves on success", async () => {
      mockFetchResponse(true);
      await expect(
        actions.rewriteLatestTurn("t1", {
          branchId: "b1",
          expectedHeadTurnId: "head1",
          mode: "regenerate",
        }),
      ).resolves.toBeUndefined();
    });

    it("rewrites the latest user turn", async () => {
      mockFetchResponse(true);
      await expect(
        actions.rewriteLatestTurn("t1", {
          branchId: "b1",
          expectedHeadTurnId: "head1",
          mode: "user",
          text: "Rewrite this.",
        }),
      ).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: "b1",
          expectedHeadTurnId: "head1",
          mode: "user",
          text: "Rewrite this.",
        }),
      });
    });

    it("rewrites the latest assistant turn", async () => {
      mockFetchResponse(true);
      await expect(
        actions.rewriteLatestTurn("t1", {
          branchId: "b1",
          expectedHeadTurnId: "head1",
          mode: "assistant",
          text: "Keep only context a.",
        }),
      ).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith("/api/chats/t1/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: "b1",
          expectedHeadTurnId: "head1",
          mode: "assistant",
          text: "Keep only context a.",
        }),
      });
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
