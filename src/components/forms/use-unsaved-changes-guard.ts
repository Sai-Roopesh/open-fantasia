"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfirmationRequest } from "@/components/ui/confirmation-dialog";

/**
 * Protects against accidental navigation when a form has unsaved changes.
 *
 * - `beforeunload`: handled natively by the browser (cannot be replaced with
 *   a custom modal — the browser requires synchronous confirmation).
 * - In-page link clicks: intercepted and shown via a `ConfirmationDialog`
 *   rendered by the consuming component using the returned `confirmRequest`.
 *
 * The consuming component must render a `<ConfirmationDialog>` with the
 * returned `confirmRequest` and `clearConfirm` props.
 */
export function useUnsavedChangesGuard(isDirty: boolean, message: string) {
  const [confirmRequest, setConfirmRequest] = useState<ConfirmationRequest | null>(null);
  const pendingLinkRef = useRef<HTMLAnchorElement | null>(null);

  const clearConfirm = useCallback(() => {
    pendingLinkRef.current = null;
    setConfirmRequest(null);
  }, []);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      event.preventDefault();
      event.stopPropagation();

      pendingLinkRef.current = link;
      setConfirmRequest({
        title: "Unsaved changes",
        description: message,
        confirmLabel: "Leave page",
        cancelLabel: "Stay",
        variant: "destructive",
        onConfirm: () => {
          const pending = pendingLinkRef.current;
          pendingLinkRef.current = null;
          if (pending) {
            // Temporarily remove the click listener to avoid re-intercepting.
            document.removeEventListener("click", handleDocumentClick, true);
            pending.click();
            // Re-attach on the next tick so subsequent navigations are guarded.
            requestAnimationFrame(() => {
              document.addEventListener("click", handleDocumentClick, true);
            });
          }
        },
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty, message]);

  return { confirmRequest, clearConfirm };
}
