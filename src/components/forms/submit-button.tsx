"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className,
  disabled = false,
  type = "submit",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const { pending } = useFormStatus();

  return (
    <button
      type={type}
      disabled={pending || disabled}
      className={cn(
        "inline-flex items-center justify-center rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {pending ? "Working..." : children}
    </button>
  );
}
