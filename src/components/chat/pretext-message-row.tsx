"use client";

import { memo, useMemo } from "react";
import {
  Check,
  Copy,
  GitBranchPlus,
  PencilLine,
  Pin,
  RefreshCcw,
  RotateCcw,
  Star,
} from "lucide-react";
import { getTextFromMessage } from "@/lib/ai/message-text";
import type { EditableTurnTarget, FantasiaUIMessage, TranscriptControl } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseMarkdownLiteCached } from "@/lib/pretext/parse-cache";
import {
  type InlineMark,
  type RichTextBlock,
} from "@/lib/pretext/markdown-lite";
import { ActionButton } from "@/components/chat/chat-action-ui";

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

function RichTextBlockView({ block, focusMode }: { block: RichTextBlock; focusMode?: boolean }) {
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
        "whitespace-pre-wrap",
        focusMode ? "text-[16px] leading-[2.15] md:text-[17px]" : "text-[15px] leading-7",
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

export type PretextMessageRowProps = {
  message: FantasiaUIMessage;
  assistantLabel: string;
  controls: TranscriptControl | undefined;
  pendingActive: boolean;
  rewriteBlocked: boolean;
  focusMode: boolean;
  copyStatus: "success" | "error" | null;
  timestampFormatter: Intl.DateTimeFormat;
  onRegenerate: (turnId: string) => void;
  onOpenEditMessage: (
    messageId: string,
    currentText: string,
    target: EditableTurnTarget,
  ) => void;
  onOpenBranchFromCheckpoint: (turnId: string) => void;
  onRewindCheckpoint: (turnId: string) => void;
  onOpenPinMessage: (messageId: string, currentText: string) => void;
  onRateCheckpoint: (turnId: string, rating: number) => void;
  onCopy: (messageId: string, value: string) => void;
};

function PretextMessageRowImpl({
  message,
  assistantLabel,
  controls,
  pendingActive,
  rewriteBlocked,
  focusMode,
  copyStatus,
  timestampFormatter,
  onRegenerate,
  onOpenEditMessage,
  onOpenBranchFromCheckpoint,
  onRewindCheckpoint,
  onOpenPinMessage,
  onRateCheckpoint,
  onCopy,
}: PretextMessageRowProps) {
  const metadata = message.metadata;
  const isUser = message.role === "user";
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

  // Parsing is memoized by text: committed strings parse once; only the live
  // streaming row re-parses each throttled frame (and that work is cheap).
  const blocks = useMemo(() => parseMarkdownLiteCached(messageText), [messageText]);
  const hasActionBar = Boolean(controls) || messageText.trim().length > 0;
  const isCopySuccess = copyStatus === "success";
  const isCopyError = copyStatus === "error";

  return (
    <div className={cn("flex flex-col gap-3", isUser && "items-end")}>
      <article
        className={cn(
          "w-full rounded-lg px-4 py-3",
          isUser
            ? "max-w-[min(54ch,92%)] bg-surface-container-high text-on-surface"
            : "max-w-[min(72ch,100%)] bg-surface-container text-on-surface-variant",
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.05em] opacity-60">
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
              focusMode={focusMode}
            />
          ))}
        </div>

        {!isUser && metadata?.finishReason === "length" ? (
          <div className="mt-3 flex items-start gap-1.5 rounded border border-status-warning/30 bg-status-warning/10 p-2.5 text-xs text-status-warning">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <p className="leading-5">
              Response was truncated — the model hit the output limit. Try increasing &quot;Response length&quot; in the character&apos;s Voice settings, or regenerate.
            </p>
          </div>
        ) : null}
      </article>

      {hasActionBar ? (
        <div
          className={cn(
            "flex max-w-[min(72ch,100%)] flex-col gap-3 px-1 text-left",
            isUser && "items-end text-right",
          )}
        >
          <div className={cn("flex flex-wrap gap-1", isUser && "justify-end")}>
            {controls?.canEdit ? (
              <ActionButton
                disabled={pendingActive || rewriteBlocked}
                onClick={() =>
                  onOpenEditMessage(message.id, messageText, isUser ? "user" : "assistant")
                }
                icon={PencilLine}
              >
                {isUser ? "Edit last user" : "Edit last reply"}
              </ActionButton>
            ) : null}
            {controls?.canRewind ? (
              <ActionButton
                disabled={pendingActive}
                onClick={() => onRewindCheckpoint(controls.turnId)}
                icon={RotateCcw}
              >
                Rewind here
              </ActionButton>
            ) : null}
            {controls?.canRegenerate ? (
              <ActionButton
                disabled={pendingActive || rewriteBlocked}
                onClick={() => onRegenerate(controls.turnId)}
                icon={RefreshCcw}
              >
                Regenerate
              </ActionButton>
            ) : null}
            {controls?.canBranch ? (
              <ActionButton
                disabled={pendingActive}
                onClick={() => onOpenBranchFromCheckpoint(controls.turnId)}
                icon={GitBranchPlus}
              >
                Branch from here
              </ActionButton>
            ) : null}
            {messageText.trim().length > 0 ? (
              <ActionButton
                onClick={() => onCopy(message.id, messageText)}
                icon={isCopySuccess ? Check : Copy}
              >
                {isCopySuccess ? "Copied" : isCopyError ? "Copy failed" : "Copy"}
              </ActionButton>
            ) : null}
            {controls?.canPin ? (
              <ActionButton
                disabled={pendingActive}
                onClick={() => onOpenPinMessage(message.id, messageText)}
                icon={Pin}
              >
                Pin fact
              </ActionButton>
            ) : null}
          </div>

          {controls?.canRate ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-1.5 text-[10px] text-on-surface-variant/60",
                isUser && "justify-end",
              )}
            >
              <span className="uppercase tracking-[0.05em]">Rate</span>
              {[1, 2, 3, 4].map((rating) => (
                <button
                  key={`${controls.turnId}-rating-${rating}`}
                  type="button"
                  disabled={pendingActive}
                  onClick={() => onRateCheckpoint(controls.turnId, rating)}
                  className={cn(
                    "rounded border border-border-subtle bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface disabled:opacity-50",
                    controls.feedbackRating === rating
                      ? "border-primary-container bg-primary-container/10 text-primary-container"
                      : "",
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
}

/**
 * Re-render a row only when its own rendered data changes. Handler props are
 * intentionally excluded: any state a handler closes over that affects this row
 * (head turn, branch, rating) also changes `controls`/`message`, which are
 * compared — so a skipped row never holds a behaviorally stale handler. During a
 * stream, only the live message's text changes, so only that row re-renders.
 */
function rowPropsEqual(prev: PretextMessageRowProps, next: PretextMessageRowProps) {
  return (
    prev.message.id === next.message.id &&
    getTextFromMessage(prev.message) === getTextFromMessage(next.message) &&
    prev.message.metadata?.createdAt === next.message.metadata?.createdAt &&
    prev.message.metadata?.provider === next.message.metadata?.provider &&
    prev.message.metadata?.model === next.message.metadata?.model &&
    prev.message.metadata?.finishReason === next.message.metadata?.finishReason &&
    prev.controls === next.controls &&
    prev.pendingActive === next.pendingActive &&
    prev.rewriteBlocked === next.rewriteBlocked &&
    prev.focusMode === next.focusMode &&
    prev.copyStatus === next.copyStatus &&
    prev.assistantLabel === next.assistantLabel &&
    prev.timestampFormatter === next.timestampFormatter
  );
}

export const PretextMessageRow = memo(PretextMessageRowImpl, rowPropsEqual);
