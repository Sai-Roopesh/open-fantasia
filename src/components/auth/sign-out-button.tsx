"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <form action="/auth/signout" method="post">
      <Button
        type="submit"
        variant="outline"
        size={compact ? "sm" : "default"}
        className={className}
        data-testid="sign-out-button"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </form>
  );
}
