"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import type { EditableTurnTarget, FantasiaUIMessage, TranscriptControl } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PretextMessageRow } from "@/components/chat/pretext-message-row";

function isNearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

export function PretextTranscript({
  messages,
  assistantLabel,
  controlsByMessageId,
  pendingAction,
  focusMode = false,
  rewriteBlocked = false,
  onRegenerate,
  onOpenEditMessage,
  onOpenBranchFromCheckpoint,
  onRewindCheckpoint,
  onOpenPinMessage,
  onRateCheckpoint,
}: {
  messages: FantasiaUIMessage[];
  assistantLabel: string;
  controlsByMessageId: Record<string, TranscriptControl>;
  pendingAction: string | null;
  focusMode?: boolean;
  rewriteBlocked?: boolean;
  onRegenerate: (turnId: string) => Promise<void>;
  onOpenEditMessage: (
    messageId: string,
    currentText: string,
    target: EditableTurnTarget,
  ) => void;
  onOpenBranchFromCheckpoint: (turnId: string) => void;
  onRewindCheckpoint: (turnId: string) => Promise<void>;
  onOpenPinMessage: (messageId: string, currentText: string) => void;
  onRateCheckpoint: (turnId: string, rating: number) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const [followOutput, setFollowOutput] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<{
    messageId: string;
    status: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const element = scrollRef.current;

    const updateFollowState = () => {
      setFollowOutput(isNearBottom(element));
    };

    updateFollowState();
    element.addEventListener("scroll", updateFollowState, { passive: true });

    return () => {
      element.removeEventListener("scroll", updateFollowState);
    };
  }, []);

  // Follow token growth smoothly: when pinned to the bottom, track every change
  // in content height (not just message count) so streaming output stays in view.
  useEffect(() => {
    const content = contentRef.current;
    const scroll = scrollRef.current;
    if (!content || !scroll) return;

    const observer = new ResizeObserver(() => {
      if (followOutput) {
        scroll.scrollTop = scroll.scrollHeight;
      }
    });
    observer.observe(content);

    return () => observer.disconnect();
  }, [followOutput]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  function setCopyFeedbackWithReset(
    messageId: string,
    status: "success" | "error",
  ) {
    setCopyFeedback({ messageId, status });
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyFeedback((current) =>
        current?.messageId === messageId ? null : current,
      );
    }, 1800);
  }

  async function copyMessage(messageId: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedbackWithReset(messageId, "success");
    } catch {
      setCopyFeedbackWithReset(messageId, "error");
    }
  }

  const showJumpToLatest = messages.length > 0 && !followOutput;
  const pendingActive = pendingAction !== null;

  const timestampFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  return (
    <div className={cn("relative", focusMode && "h-full")}>
      <div
        ref={scrollRef}
        className={cn(
          "relative overflow-y-auto bg-background-base px-3 py-4",
          focusMode
            ? "h-full rounded-lg border border-border-subtle"
            : "h-[68vh] min-h-[28rem] rounded-lg border border-border-subtle",
        )}
      >
        <div
          ref={contentRef}
          className={cn("mx-auto flex flex-col gap-5 py-1", focusMode ? "max-w-[65ch]" : "max-w-4xl")}
        >
          {messages.map((message) => (
            <PretextMessageRow
              key={message.id}
              message={message}
              assistantLabel={assistantLabel}
              controls={controlsByMessageId[message.id]}
              pendingActive={pendingActive}
              rewriteBlocked={rewriteBlocked}
              focusMode={focusMode}
              copyStatus={
                copyFeedback?.messageId === message.id ? copyFeedback.status : null
              }
              timestampFormatter={timestampFormatter}
              onRegenerate={onRegenerate}
              onOpenEditMessage={onOpenEditMessage}
              onOpenBranchFromCheckpoint={onOpenBranchFromCheckpoint}
              onRewindCheckpoint={onRewindCheckpoint}
              onOpenPinMessage={onOpenPinMessage}
              onRateCheckpoint={onRateCheckpoint}
              onCopy={copyMessage}
            />
          ))}
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          onClick={() => {
            if (!scrollRef.current) return;
            setFollowOutput(true);
            scrollRef.current.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            });
          }}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded bg-surface-container-high border border-border-subtle px-3 py-1.5 text-xs font-semibold text-on-surface"
        >
          <ArrowDown className="h-4 w-4" />
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
