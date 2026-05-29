"use client";

import { useCallback, useOptimistic, useTransition } from "react";
import type { ActionResult } from "@/lib/types";

export type OptimisticOp<T> =
  | { kind: "upsert"; item: T }
  | { kind: "update"; id: string; patch: Partial<T> }
  | { kind: "remove"; id: string };

/**
 * Reusable optimistic list pattern for server-action-backed lists (threads,
 * personas, characters, providers).
 *
 * The optimistic op is applied immediately inside a transition, then the server
 * action runs. Because the action calls `revalidatePath`, fresh server items flow
 * in as part of the same transition — so React reconciles the optimistic value to
 * the authoritative one with no timer and no snap-back. On failure the optimistic
 * value is discarded (the transition ends without a matching server change) and
 * the error is surfaced via `onError`.
 */
export function useOptimisticList<T>(serverItems: T[], keyOf: (item: T) => string) {
  const [items, applyOptimistic] = useOptimistic(
    serverItems,
    (current: T[], op: OptimisticOp<T>) => {
      switch (op.kind) {
        case "upsert": {
          const id = keyOf(op.item);
          return current.some((item) => keyOf(item) === id)
            ? current.map((item) => (keyOf(item) === id ? op.item : item))
            : [op.item, ...current];
        }
        case "update":
          return current.map((item) =>
            keyOf(item) === op.id ? { ...item, ...op.patch } : item,
          );
        case "remove":
          return current.filter((item) => keyOf(item) !== op.id);
        default:
          return current;
      }
    },
  );

  const [isPending, startTransition] = useTransition();

  const run = useCallback(
    (
      op: OptimisticOp<T>,
      action: () => Promise<ActionResult>,
      onError?: (message: string) => void,
    ) => {
      startTransition(async () => {
        applyOptimistic(op);
        try {
          const result = await action();
          if (!result.ok) {
            onError?.(result.error);
          }
        } catch (error) {
          onError?.(error instanceof Error ? error.message : "That action failed.");
        }
      });
    },
    [applyOptimistic],
  );

  return { items, isPending, run };
}
