"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { useConfirmation } from "@/components/ui/confirmation-dialog";

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  className,
}: {
  children: React.ReactNode;
  confirmMessage: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const { confirm, confirmDialog } = useConfirmation();
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={pending}
        onClick={() => {
          // Capture the form reference synchronously *before* the dialog opens.
          // Once the confirmation dialog mounts, focus shifts to the dialog's
          // own buttons (inside a portal, outside the form), so we can't rely
          // on document.activeElement at confirm-time to locate the form.
          const form = buttonRef.current?.closest("form");
          confirm({
            title: "Are you sure?",
            description: confirmMessage,
            confirmLabel: "Continue",
            variant: "destructive",
            onConfirm: () => {
              form?.requestSubmit();
            },
          });
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        {pending ? "Working..." : children}
      </button>
      {confirmDialog}
    </>
  );
}
