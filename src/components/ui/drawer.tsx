"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  children: React.ReactNode;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  side,
  children,
  className,
}: DrawerProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 z-50 flex w-72 flex-col overflow-y-auto border-[#444444] bg-[#1c1b1b]",
          side === "left" && "left-0 border-r",
          side === "right" && "right-0 border-l",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}
