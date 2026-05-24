import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="brand-mark">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-container-high text-primary-container">
        <Sparkles className="h-4 w-4" />
      </div>
      <div>
        <p className="font-display text-lg font-bold leading-none tracking-[0.02em] text-on-surface">
          Fantasia
        </p>
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          Open roleplay workspace
        </p>
      </div>
    </div>
  );
}
