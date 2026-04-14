"use client";

import type { RefObject } from "react";
import {
  AlertTriangle,
  Send,
  WandSparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="mt-5 rounded-[1.75rem] border border-border bg-white/5 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-ink-soft">
        <WandSparkles className="h-4 w-4 text-brand" />
        First turn guidance
      </div>
      <h3 className="mt-3 font-serif text-3xl text-foreground">
        {suggestedStarters.length
          ? "Let the character open from one of the seeded beats."
          : "This character has no starters yet, so type your own opening turn."}
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">
        Pick a card and Fantasia will generate the character&apos;s first visible message from
        that seed. You reply after the opening lands. The active model and branch still control
        how that first beat is generated.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                "rounded-[1.5rem] border border-border bg-paper px-4 py-4 text-left transition",
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "hover:border-brand hover:bg-white/10",
              )}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{title}</p>
              <p className="mt-3 text-sm leading-7 text-foreground">{starter}</p>
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
    <div className="mt-5 rounded-[1.6rem] border border-border bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
            Model switcher
          </p>
          <p className="mt-2 text-sm leading-7 text-ink-soft">
            Choose the exact lane you want next. Nothing changes automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border bg-paper/8 px-3 py-1.5 font-semibold text-foreground transition hover:border-brand hover:text-brand disabled:opacity-60"
        >
          Close
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {modelChoices.length ? (
          modelChoices.map((group) => (
            <div
              key={group.connectionId}
              className="rounded-[1.4rem] border border-border bg-paper px-4 py-4"
            >
              <p className="text-sm font-semibold text-foreground">{group.label}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-soft">
                {group.provider}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.models.map((model) => (
                  <button
                    key={`${group.connectionId}-${model.id}`}
                    type="button"
                    disabled={switchPending}
                    onClick={() => void onSelectModel(group.connectionId, model.id)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-xs transition",
                      model.id === currentModel
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-white/8 text-foreground hover:border-brand hover:text-brand",
                    )}
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-[1.4rem] border border-dashed border-border px-4 py-4 text-sm leading-7 text-ink-soft">
            No refreshed model lanes are available yet. Test a provider connection and refresh its models first.
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
  fallbackModels,
  onEditDraft,
  onRetry,
  onShowModelPicker,
}: {
  activeError: string;
  composerBusy: boolean;
  failedDraft: string | null;
  fallbackModels: Array<{
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
      className="mt-4 rounded-[1.6rem] border border-brand/18 bg-brand/8 p-4 text-sm text-brand-strong"
    >
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        Response interrupted
      </div>
      <p className="mt-2 leading-7">{activeError}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand">
        Your draft is preserved until a send completes successfully.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {failedDraft ? (
          <>
            <button
              type="button"
              disabled={composerBusy}
              onClick={() => onRetry(failedDraft)}
              className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
            >
              Retry send
            </button>
            <button
              type="button"
              onClick={() => onEditDraft(failedDraft)}
              className="rounded-full border border-brand/25 bg-white/8 px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
            >
              Edit draft
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onShowModelPicker}
          className="rounded-full border border-brand/25 bg-white/8 px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
        >
          Switch model
        </button>
      </div>

      {fallbackModels.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {fallbackModels.map((option) => (
            <span
              key={`${option.connectionId}-${option.model.id}`}
              className="rounded-full border border-brand/18 bg-white/8 px-3 py-1 text-xs"
            >
              {option.label}: {option.model.name}
            </span>
          ))}
        </div>
      ) : null}
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
  return (
    <form
      className={cn(
        "flex flex-col gap-3 md:flex-row",
        focusMode
          ? "mx-auto w-full max-w-3xl shrink-0 px-1 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
          : "mt-5",
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
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Enter the next beat, confession, interruption, or scene turn..."
          data-testid="chat-composer-input"
          className="w-full rounded-[1.75rem] border border-border bg-white/5 px-5 py-4 text-sm leading-7 outline-none transition focus:border-brand"
        />
      </label>
      <button
        type="submit"
        disabled={composerBusy}
        data-testid="chat-send-button"
        className="inline-flex h-fit items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {status === "streaming" || status === "submitted" ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
