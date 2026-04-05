import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-md">
        <Sparkles suppressHydrationWarning className="h-5 w-5" />
      </div>
      <div>
        <p className="font-serif text-2xl leading-none tracking-[0.08em] text-white">
          Fantasia
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.28em] text-white/70">
          Open roleplay workspace
        </p>
      </div>
    </div>
  );
}
