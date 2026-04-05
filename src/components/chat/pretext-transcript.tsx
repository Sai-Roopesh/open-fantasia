"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, GitBranchPlus, PencilLine, Pin, RefreshCcw, Star } from "lucide-react";
import type { FantasiaUIMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseMarkdownLite } from "@/lib/pretext/markdown-lite";
import { layoutRichMessage, type RenderedMessageLayout } from "@/lib/pretext/layout";

type LayoutMap = Record<string, RenderedMessageLayout>;

export type TranscriptControl = {
  checkpointId: string;
  branchId: string;
  canEdit: boolean;
  canRegenerate: boolean;
  canBranch: boolean;
  canPin: boolean;
  canRate: boolean;
  feedbackRating: number | null;
  alternates: Array<{
    checkpointId: string;
    selected: boolean;
    label: string;
  }>;
};

function isNearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

export function PretextTranscript({
  messages,
  assistantLabel,
  controlsByMessageId,
  pendingAction,
  onRegenerate,
  onOpenAlternates,
  onOpenEditMessage,
  onOpenBranchFromCheckpoint,
  onOpenPinMessage,
  onRateCheckpoint,
}: {
  messages: FantasiaUIMessage[];
  assistantLabel: string;
  controlsByMessageId: Record<string, TranscriptControl>;
  pendingAction: string | null;
  onRegenerate: (checkpointId: string) => Promise<void>;
  onOpenAlternates: (control: TranscriptControl) => void;
  onOpenEditMessage: (messageId: string, currentText: string) => void;
  onOpenBranchFromCheckpoint: (checkpointId: string) => void;
  onOpenPinMessage: (messageId: string, currentText: string) => void;
  onRateCheckpoint: (checkpointId: string, rating: number) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLParagraphElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [font, setFont] = useState("");
  const [layouts, setLayouts] = useState<LayoutMap>({});
  const [followOutput, setFollowOutput] = useState(true);
  const deferredMessages = useDeferredValue(messages);

  useEffect(() => {
    if (!scrollRef.current) return;
    const element = scrollRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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

  useEffect(() => {
    let active = true;
    const updateFont = async () => {
      await document.fonts.ready;
      if (!active || !probeRef.current) return;
      const style = getComputedStyle(probeRef.current);
      setFont(style.font);
    };

    void updateFont();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!font || containerWidth <= 0) return;

    startTransition(() => {
      const nextLayouts: LayoutMap = {};
      for (const message of deferredMessages) {
        const text = getMessageText(message);
        nextLayouts[message.id] = layoutRichMessage({
          blocks: parseMarkdownLite(text),
          font,
          maxBubbleWidth: Math.min(containerWidth * 0.74, 720),
          lineHeight: 28,
        });
      }
      setLayouts(nextLayouts);
    });
  }, [containerWidth, deferredMessages, font]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: deferredMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const message = deferredMessages[index];
      const layout = message ? layouts[message.id] : null;
      const controls = message ? controlsByMessageId[message.id] : null;
      const controlRows =
        (controls?.alternates.length && controls.alternates.length > 1 ? 1 : 0) +
        (controls?.canRate ? 1 : 0) +
        (controls?.canEdit || controls?.canRegenerate || controls?.canBranch || controls?.canPin
          ? 1
          : 0);
      return (layout?.bubbleHeight ?? 164) + controlRows * 48 + 18;
    },
    overscan: 6,
    gap: 18,
  });

  const totalSize = rowVirtualizer.getTotalSize();

  useEffect(() => {
    if (!scrollRef.current || !followOutput) return;
    const element = scrollRef.current;
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }, [followOutput, totalSize, messages.length]);

  const showJumpToLatest = messages.length > 0 && !followOutput;

  const timestampFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="relative h-[64vh] overflow-y-auto rounded-[2rem] border border-border bg-[#f8f1e8]/75 px-3 py-4"
      >
        <p
          ref={probeRef}
          className="pointer-events-none absolute opacity-0 font-sans text-base font-medium leading-7"
        >
          transcript probe
        </p>

        {!font ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-soft">
            Calibrating transcript layout...
          </div>
        ) : (
          <div className="relative w-full" style={{ height: `${totalSize}px` }}>
            {rowVirtualizer.getVirtualItems().map((item) => {
              const message = deferredMessages[item.index];
              const layout = layouts[message.id];
              const metadata = message.metadata;
              const isUser = message.role === "user";
              const controls = controlsByMessageId[message.id];
              const messageText = getMessageText(message);
              const createdAt = metadata?.createdAt
                ? timestampFormatter.format(new Date(metadata.createdAt))
                : null;
              const messageLabel =
                message.role === "assistant"
                  ? assistantLabel
                  : message.role === "user"
                    ? "You"
                    : "System";

              return (
                <div
                  key={message.id}
                  ref={rowVirtualizer.measureElement}
                  className={cn("absolute left-0 w-full px-1", isUser && "text-right")}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <div
                    className={cn(
                      "inline-block max-w-full rounded-[1.8rem] px-5 py-4 shadow-lg",
                      {
                        "bg-[#f1decb] text-[#21130b]": isUser,
                        "bg-[#231710] text-[#fff6ef]": !isUser,
                      },
                    )}
                    style={{
                      width: layout ? `${Math.max(layout.bubbleWidth, 180)}px` : undefined,
                    }}
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] opacity-65">
                      <span>{messageLabel}</span>
                      {createdAt ? <span>{createdAt}</span> : null}
                      {metadata?.provider ? <span>{metadata.provider}</span> : null}
                      {metadata?.model ? (
                        <span className="truncate">{metadata.model}</span>
                      ) : null}
                    </div>

                    <div className="space-y-3 text-left font-sans text-base leading-7">
                      {layout?.blocks.map((block, blockIndex) => {
                        if (block.kind === "separator") {
                          return (
                            <div
                              key={`${message.id}-separator-${blockIndex}`}
                              className="flex items-center justify-center py-1"
                            >
                              <div className="h-px w-16 rounded-full bg-current/22" />
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`${message.id}-${block.kind}-${blockIndex}`}
                            className={cn(
                              block.kind === "quote" && "border-l border-current/20 pl-4",
                            )}
                          >
                            {block.lines.map((line, lineIndex) => (
                              <div
                                key={`${message.id}-${blockIndex}-${lineIndex}`}
                                className="min-h-7 whitespace-pre"
                              >
                                {line.runs.length
                                  ? line.runs.map((run, runIndex) => (
                                      <span
                                        key={`${message.id}-${blockIndex}-${lineIndex}-${runIndex}`}
                                        className={cn(
                                          run.bold && "font-semibold",
                                          run.italic && "italic",
                                        )}
                                      >
                                        {run.text}
                                      </span>
                                    ))
                                  : line.text}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {controls ? (
                      <div className="mt-4 space-y-3 border-t border-current/10 pt-3 text-left">
                        <div className="flex flex-wrap gap-2">
                          {controls.canEdit ? (
                            <ActionButton
                              disabled={pendingAction !== null}
                              onClick={() => onOpenEditMessage(message.id, messageText)}
                              icon={PencilLine}
                            >
                              Edit last user
                            </ActionButton>
                          ) : null}
                          {controls.canRegenerate ? (
                            <ActionButton
                              disabled={pendingAction !== null}
                              onClick={() => onRegenerate(controls.checkpointId)}
                              icon={RefreshCcw}
                            >
                              Regenerate
                            </ActionButton>
                          ) : null}
                          {controls.canBranch ? (
                            <ActionButton
                              disabled={pendingAction !== null}
                              onClick={() => onOpenBranchFromCheckpoint(controls.checkpointId)}
                              icon={GitBranchPlus}
                            >
                              Branch from here
                            </ActionButton>
                          ) : null}
                          {controls.canPin ? (
                            <ActionButton
                              disabled={pendingAction !== null}
                              onClick={() => onOpenPinMessage(message.id, messageText)}
                              icon={Pin}
                            >
                              Pin fact
                            </ActionButton>
                          ) : null}
                        </div>

                        {controls.alternates.length > 1 ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="uppercase tracking-[0.18em] opacity-60">
                              Alternates
                            </span>
                            <button
                              type="button"
                              disabled={pendingAction !== null}
                              onClick={() => onOpenAlternates(controls)}
                              className="rounded-full border border-current/15 px-3 py-1.5 font-semibold transition hover:bg-white/10 disabled:opacity-60"
                            >
                              {controls.alternates.find((option) => option.selected)?.label ??
                                "Choose"}{" "}
                              selected
                            </button>
                            <span className="opacity-60">
                              {controls.alternates.length} variants saved on this checkpoint
                            </span>
                          </div>
                        ) : null}

                        {controls.canRate ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="uppercase tracking-[0.18em] opacity-60">
                              Rate this turn
                            </span>
                            {[1, 2, 3, 4].map((rating) => (
                              <button
                                key={`${controls.checkpointId}-rating-${rating}`}
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() => onRateCheckpoint(controls.checkpointId, rating)}
                                className={cn(
                                  "rounded-full border px-3 py-1.5 font-semibold transition disabled:opacity-60",
                                  controls.feedbackRating === rating
                                    ? "border-current/15 bg-current/10"
                                    : "border-current/15 hover:bg-white/10",
                                )}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5" />
                                  {rating}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-lg transition hover:border-brand hover:text-brand"
        >
          <ArrowDown className="h-4 w-4" />
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  icon: typeof PencilLine;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-current/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10 disabled:opacity-60"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function getMessageText(message: FantasiaUIMessage) {
  return message.parts
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "text" &&
      "text" in part
        ? String(part.text)
        : "",
    )
    .join("");
}
