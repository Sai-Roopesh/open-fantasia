"use client";

import { cn } from "@/lib/utils";

/**
 * The assistant "is typing" affordance shown between sending a turn and the first
 * streamed token (WhatsApp-style bouncing dots). It mirrors the assistant message
 * bubble so the transition into the real streamed reply is seamless. Once the first
 * token arrives the live message renders and this is unmounted.
 */
export function TypingIndicator({
  label,
  focusMode = false,
}: {
  label: string;
  focusMode?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <article
        className={cn(
          "w-full max-w-[min(72ch,100%)] rounded-lg bg-surface-container px-4 py-3 text-on-surface-variant",
          focusMode && "max-w-[65ch]",
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.05em] opacity-60">
          <span>{label}</span>
        </div>
        <div
          className="flex items-center gap-1.5 py-1"
          role="status"
          aria-label={`${label} is typing`}
        >
          <span className="typing-dot block h-2 w-2 rounded-full bg-current/70" style={{ animationDelay: "0ms" }} />
          <span className="typing-dot block h-2 w-2 rounded-full bg-current/70" style={{ animationDelay: "160ms" }} />
          <span className="typing-dot block h-2 w-2 rounded-full bg-current/70" style={{ animationDelay: "320ms" }} />
        </div>
      </article>
    </div>
  );
}
