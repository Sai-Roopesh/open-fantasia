"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  GitBranchPlus,
  PencilLine,
  Pin,
  RefreshCcw,
  RotateCcw,
  Star,
} from "lucide-react";
import { getTextFromMessage } from "@/lib/ai/message-text";
import type { FantasiaUIMessage, TranscriptControl } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  parseMarkdownLite,
  type InlineMark,
  type RichTextBlock,
} from "@/lib/pretext/markdown-lite";
import { ActionButton } from "@/components/chat/chat-workspace-parts";

function isNearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

function sliceMarkedRuns(text: string, marks: InlineMark[]) {
  const boundaries = new Set<number>([0, text.length]);
  for (const mark of marks) {
    boundaries.add(mark.start);
    boundaries.add(mark.end);
  }

  return Array.from(boundaries)
    .sort((left, right) => left - right)
    .slice(0, -1)
    .map((start, index, items) => {
      const end = items[index + 1] ?? text.length;
      const value = text.slice(start, end);
      const activeMarks = marks.filter((mark) => mark.start <= start && mark.end >= end);
      return {
        text: value,
        bold: activeMarks.some((mark) => mark.bold),
        italic: activeMarks.some((mark) => mark.italic),
      };
    })
    .filter((run) => run.text.length > 0);
}

function RichTextBlockView({ block }: { block: RichTextBlock }) {
  if (block.kind === "separator") {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="h-px w-16 rounded-full bg-current/18" />
      </div>
    );
  }

  const Tag = block.kind === "quote" ? "blockquote" : "p";
  const runs = sliceMarkedRuns(block.text, block.marks);

  return (
    <Tag
      className={cn(
        "whitespace-pre-wrap text-[15px] leading-7",
        block.kind === "quote" && "border-l border-current/20 pl-4 italic",
      )}
    >
      {runs.length
        ? runs.map((run, index) => (
            <span
              key={`${block.kind}-${index}-${run.text}`}
              className={cn(run.bold && "font-semibold", run.italic && "italic")}
            >
              {run.text}
            </span>
          ))
        : block.text}
    </Tag>
  );
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
  onRewindCheckpoint,
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
  onRewindCheckpoint: (checkpointId: string, currentText: string) => Promise<void>;
  onOpenPinMessage: (messageId: string, currentText: string) => void;
  onRateCheckpoint: (checkpointId: string, rating: number) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [followOutput, setFollowOutput] = useState(true);

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
    if (!scrollRef.current || !followOutput) return;
    const element = scrollRef.current;
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }, [followOutput, messages.length]);

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
        className="relative h-[68vh] min-h-[28rem] overflow-y-auto rounded-[2rem] border border-border bg-[#f8f1e8]/75 px-3 py-4"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-5 py-1">
          {messages.map((message) => {
            const metadata = message.metadata;
            const isUser = message.role === "user";
            const controls = controlsByMessageId[message.id];
            const messageText = getTextFromMessage(message);
            const createdAt = metadata?.createdAt
              ? timestampFormatter.format(new Date(metadata.createdAt))
              : null;
            const messageLabel =
              message.role === "assistant"
                ? assistantLabel
                : message.role === "user"
                  ? "You"
                  : "System";
            const blocks = parseMarkdownLite(messageText);

            return (
              <div key={message.id} className={cn("flex flex-col gap-3", isUser && "items-end")}>
                <article
                  className={cn(
                    "w-full rounded-[1.8rem] px-5 py-4 shadow-[0_14px_40px_rgba(35,23,16,0.08)]",
                    isUser
                      ? "max-w-[min(54ch,92%)] bg-[#f1decb] text-[#21130b]"
                      : "max-w-[min(72ch,100%)] bg-[#231710] text-[#fff6ef]",
                  )}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] opacity-65">
                    <span>{messageLabel}</span>
                    {createdAt ? <span>{createdAt}</span> : null}
                    {!isUser && metadata?.provider ? <span>{metadata.provider}</span> : null}
                    {!isUser && metadata?.model ? <span className="truncate">{metadata.model}</span> : null}
                  </div>

                  <div className="space-y-3 text-left">
                    {blocks.map((block, blockIndex) => (
                      <RichTextBlockView
                        key={`${message.id}-${block.kind}-${blockIndex}`}
                        block={block}
                      />
                    ))}
                  </div>
                </article>

                {controls ? (
                  <div
                    className={cn(
                      "flex max-w-[min(72ch,100%)] flex-col gap-3 px-1 text-left",
                      isUser && "items-end text-right",
                    )}
                  >
                    <div className={cn("flex flex-wrap gap-2", isUser && "justify-end")}>
                      {controls.canEdit ? (
                        <ActionButton
                          disabled={pendingAction !== null}
                          onClick={() => onOpenEditMessage(message.id, messageText)}
                          icon={PencilLine}
                        >
                          Edit last user
                        </ActionButton>
                      ) : null}
                      {controls.canRewind ? (
                        <ActionButton
                          disabled={pendingAction !== null}
                          onClick={() => void onRewindCheckpoint(controls.checkpointId, messageText)}
                          icon={RotateCcw}
                        >
                          Rewind here
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
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2 text-xs text-foreground/70",
                          isUser && "justify-end",
                        )}
                      >
                        <span className="uppercase tracking-[0.18em]">Alternates</span>
                        <button
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() => onOpenAlternates(controls)}
                          className="rounded-full border border-border bg-white px-3 py-1.5 font-semibold text-foreground transition hover:border-brand hover:text-brand disabled:opacity-60"
                        >
                          {controls.alternates.find((option) => option.selected)?.label ?? "Choose"}{" "}
                          selected
                        </button>
                        <span>{controls.alternates.length} variants saved on this checkpoint</span>
                      </div>
                    ) : null}

                    {controls.canRate ? (
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2 text-xs text-foreground/70",
                          isUser && "justify-end",
                        )}
                      >
                        <span className="uppercase tracking-[0.18em]">Rate this turn</span>
                        {[1, 2, 3, 4].map((rating) => (
                          <button
                            key={`${controls.checkpointId}-rating-${rating}`}
                            type="button"
                            disabled={pendingAction !== null}
                            onClick={() => onRateCheckpoint(controls.checkpointId, rating)}
                            className={cn(
                              "rounded-full border border-border bg-white px-3 py-1.5 font-semibold text-foreground transition disabled:opacity-60",
                              controls.feedbackRating === rating
                                ? "border-brand bg-brand/8 text-brand"
                                : "hover:border-brand hover:text-brand",
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
            );
          })}
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
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-lg transition hover:border-brand hover:text-brand"
        >
          <ArrowDown className="h-4 w-4" />
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
