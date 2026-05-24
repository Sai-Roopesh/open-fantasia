"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded text-sm font-medium whitespace-nowrap outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[#01A982] text-white hover:bg-[#01A982]/90",
        secondary:
          "border-2 border-[#01A982] text-[#01A982] bg-transparent hover:bg-[#01A982]/10",
        outline:
          "border-2 border-[#01A982] text-[#01A982] bg-transparent hover:bg-[#01A982]/10",
        ghost:
          "bg-transparent text-[#e5e2e1] hover:text-[#01A982]",
        destructive: "bg-[#FF4B4B] text-white hover:bg-[#FF4B4B]/90",
        link: "text-[#01A982] underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-10 px-6 text-sm",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
