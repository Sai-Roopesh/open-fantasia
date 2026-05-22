"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
};

/**
 * Reusable confirmation dialog component. Pass `request` to show the dialog
 * and `onClose` to dismiss it. Built on the app's Dialog primitives for
 * consistent styling, ARIA support, and focus management — replacing
 * `window.confirm()` calls throughout the app.
 */
export function ConfirmationDialog({
  request,
  onClose,
}: {
  request: ConfirmationRequest | null;
  onClose: () => void;
}) {
  if (!request) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>{request.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {request.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={request.variant === "destructive" ? "destructive" : "default"}
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
          >
            {request.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook that returns a `confirm` function and the dialog element to render.
 * Use it to replace `window.confirm()` calls with an accessible, styled dialog.
 *
 * Usage:
 * ```tsx
 * const { confirm, confirmDialog } = useConfirmation();
 *
 * function handleDelete() {
 *   confirm({
 *     title: "Delete item?",
 *     description: "This action cannot be undone.",
 *     confirmLabel: "Delete",
 *     variant: "destructive",
 *     onConfirm: () => doDelete(),
 *   });
 * }
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Delete</button>
 *     {confirmDialog}
 *   </>
 * );
 * ```
 */
export function useConfirmation() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const close = useCallback(() => setRequest(null), []);

  return {
    confirm: setRequest,
    confirmDialog: <ConfirmationDialog request={request} onClose={close} />,
  };
}
