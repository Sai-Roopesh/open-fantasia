"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[60px] w-full rounded bg-[#111111] px-3 py-2 text-sm text-[#e5e2e1] border-b-2 border-[#444444] placeholder:text-[#86948d] focus:border-[#01A982] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
