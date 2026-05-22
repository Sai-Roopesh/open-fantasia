"use client";

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

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          confirm({
            title: "Are you sure?",
            description: confirmMessage,
            confirmLabel: "Continue",
            variant: "destructive",
            onConfirm: () => {
              // Programmatically submit the closest form after confirmation.
              const button = document.activeElement as HTMLElement | null;
              const form = button?.closest("form");
              if (form) {
                form.requestSubmit();
              }
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
