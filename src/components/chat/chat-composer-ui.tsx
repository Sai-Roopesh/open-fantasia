"use client";

import type { RefObject } from "react";
import {
  AlertTriangle,
  Send,
  WandSparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_CHAT_TURN_TEXT } from "@/lib/chat-limits";
import type { ModelChoiceGroup } from "@/components/chat/chat-ui-types";

const starterScaffolds = [
  {
    title: "Open with emotional tension",
    text: "Pick up the scene with something unresolved between us. Keep the intimacy high and the conflict quiet.",
  },
  {
    title: "Drop into a new setting",
    text: "Move us into a fresh location and let the environment change the tone before anyone speaks.",
  },
  {
    title: "Ask for a confession",
    text: "Start with a question she has been avoiding, and make the answer cost her something.",
  },
];

export function EmptyStateGuide({
  suggestedStarters,
  disabled,
  onSelectStarter,
}: {
  suggestedStarters: string[];
  disabled?: boolean;
  onSelectStarter: (starter: string) => void;
}) {
  const starters = suggestedStarters.length
    ? suggestedStarters
    : starterScaffolds.map((item) => item.text);

  return (
    <div className="mt-3 rounded-lg border border-border-subtle bg-surface-container-low p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        <WandSparkles className="h-3.5 w-3.5 text-primary-container" />
        First turn
      </div>
      <p className="mt-1 text-sm font-medium text-on-surface">
        {suggestedStarters.length
          ? "Pick a starter or type your own."
          : "No starters set — type your opening."}
      </p>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">
        Pick a card and the character generates the opening message from that seed.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {starters.map((starter, index) => {
          const title = suggestedStarters[index]
            ? `Starter ${index + 1}`
            : starterScaffolds[index]?.title ?? `Prompt ${index + 1}`;
          return (
            <button
              key={`${title}-${starter}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectStarter(starter)}
              className={cn(
                "rounded border border-border-subtle bg-surface-container px-3 py-3 text-left",
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-primary-container",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{title}</p>
              <p className="mt-1 text-xs leading-4 text-on-surface">{starter}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ModelPicker({
  currentModel,
  modelChoices,
  switchPending,
  onClose,
  onSelectModel,
}: {
  currentModel: string;
  modelChoices: ModelChoiceGroup[];
  switchPending: boolean;
  onClose: () => void;
  onSelectModel: (connectionId: string, modelId: string) => Promise<void>;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border-subtle bg-surface-container-low p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Model switcher
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Choose the lane for next generation.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface"
        >
          Close
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {modelChoices.length ? (
          modelChoices.map((group) => (
            <div
              key={group.connectionId}
              className="rounded border border-border-subtle bg-surface-container px-3 py-2"
            >
              <p className="text-xs font-semibold text-on-surface">{group.label}</p>
              <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                {group.provider}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {group.models.map((model) => (
                  <button
                    key={`${group.connectionId}-${model.id}`}
                    type="button"
                    disabled={switchPending}
                    onClick={() => void onSelectModel(group.connectionId, model.id)}
                    className={cn(
                      "rounded px-2 py-1 text-[11px] font-medium",
                      model.id === currentModel
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface-container-high text-on-surface-variant",
                    )}
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded border border-dashed border-border-subtle px-3 py-3 text-xs text-muted-foreground">
            No models available. Refresh a provider connection first.
          </p>
        )}
      </div>
    </div>
  );
}

export function ErrorBanner({
  activeError,
  composerBusy,
  failedDraft,
  alternativeModels,
  onEditDraft,
  onRetry,
  onShowModelPicker,
}: {
  activeError: string;
  composerBusy: boolean;
  failedDraft: string | null;
  alternativeModels: Array<{
    connectionId: string;
    label: string;
    provider: string;
    model: ModelChoiceGroup["models"][number];
  }>;
  onEditDraft: (value: string) => void;
  onRetry: (value: string) => void;
  onShowModelPicker: () => void;
}) {
  return (
    <div
      aria-live="polite"
      className="mt-2 rounded border border-status-warning/30 bg-status-warning/10 p-3 text-xs text-status-warning"
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        Response interrupted
      </div>
      <p className="mt-1 leading-4">{activeError}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.05em]">
        Draft preserved until send succeeds.
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {failedDraft ? (
          <>
            <button
              type="button"
              disabled={composerBusy}
              onClick={() => onRetry(failedDraft)}
              className="rounded bg-primary-container px-2 py-1 text-[11px] font-semibold text-on-primary-container disabled:opacity-50"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => onEditDraft(failedDraft)}
              className="rounded bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface"
            >
              Edit draft
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onShowModelPicker}
          className="rounded bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface"
        >
          Switch model
        </button>
      </div>

      {alternativeModels.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {alternativeModels.map((option) => (
            <span
              key={`${option.connectionId}-${option.model.id}`}
              className="rounded border border-border-subtle bg-surface-container px-2 py-0.5 text-[10px]"
            >
              {option.label}: {option.model.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ContinuityBanner({
  status,
}: {
  status: {
    tone: "pending" | "error";
    title: string;
    detail: string;
  };
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "mt-2 rounded border p-3 text-xs",
        status.tone === "error"
          ? "border-status-critical/30 bg-status-critical/10 text-status-critical"
          : "border-status-warning/30 bg-status-warning/10 text-status-warning",
      )}
    >
      <p className="font-semibold uppercase tracking-[0.05em]">
        {status.title}
      </p>
      <p className="mt-1 leading-4">{status.detail}</p>
    </div>
  );
}

export function ChatComposer({
  composerBusy,
  composerRef,
  draft,
  status,
  onDraftChange,
  onSubmit,
  focusMode = false,
}: {
  composerBusy: boolean;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  status: "submitted" | "streaming" | "ready" | "error";
  onDraftChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  focusMode?: boolean;
}) {
  const characterCount = draft.length;
  const nearLimit = characterCount >= MAX_CHAT_TURN_TEXT * 0.85;
  const overLimit = characterCount > MAX_CHAT_TURN_TEXT;

  return (
    <form
      className={cn(
        "flex gap-2",
        focusMode
          ? "mx-auto w-full max-w-3xl shrink-0 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]"
          : "mt-3",
      )}
      data-testid="chat-composer"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await onSubmit();
        } catch (error) {
          console.error("Chat composer submit failed.", error);
        }
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Prompt</span>
        <textarea
          ref={composerRef}
          rows={focusMode ? 2 : 3}
          value={draft}
          maxLength={MAX_CHAT_TURN_TEXT}
          aria-invalid={overLimit}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Next beat, confession, or scene turn..."
          data-testid="chat-composer-input"
          className="w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm leading-6 text-on-surface outline-none focus:border-primary-container"
        />
        <div
          className={cn(
            "mt-0.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground",
            (nearLimit || overLimit) && "text-status-warning",
            overLimit && "text-status-critical",
          )}
        >
          <span>{MAX_CHAT_TURN_TEXT.toLocaleString()} limit</span>
          <span>
            {characterCount.toLocaleString()}/{MAX_CHAT_TURN_TEXT.toLocaleString()}
          </span>
        </div>
      </label>
      <button
        type="submit"
        disabled={composerBusy}
        data-testid="chat-send-button"
        className="inline-flex h-fit items-center justify-center gap-1 self-end rounded bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        {status === "streaming" || status === "submitted" ? "..." : "Send"}
      </button>
    </form>
  );
}
