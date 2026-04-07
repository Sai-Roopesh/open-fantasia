"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircleMore,
  Send,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { cn, formatLongDateTime } from "@/lib/utils";
import type {
  ChatBranchRecord,
  ContinuityInspectorView,
  ModelCatalogEntry,
  TranscriptControl,
} from "@/lib/types";

export type ActionSheetState =
  | {
      kind: "edit";
      messageId: string;
      value: string;
    }
  | {
      kind: "branch";
      checkpointId: string;
      value: string;
    }
  | {
      kind: "pin";
      messageId: string;
      value: string;
    }
  | {
      kind: "alternates";
      control: TranscriptControl;
    };

export type ModelChoiceGroup = {
  connectionId: string;
  label: string;
  provider: string;
  models: ModelCatalogEntry[];
};

export type InspectorTab = "continuity" | "pins" | "timeline" | "branch";

export const inspectorTabs: Array<{ id: InspectorTab; label: string }> = [
  { id: "continuity", label: "Continuity" },
  { id: "pins", label: "Pins" },
  { id: "timeline", label: "Timeline" },
  { id: "branch", label: "Branch" },
];

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

export function ContextCard({
  eyebrow,
  title,
  helper,
  footer,
}: {
  eyebrow: string;
  title: string;
  helper: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.6rem] border border-border bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">{eyebrow}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{helper}</p>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

export function EmptyInspectorState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[1.5rem] border border-dashed border-border px-4 py-4 text-sm leading-7 text-ink-soft">
      {children}
    </p>
  );
}

export function BranchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-paper px-4 py-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-ink-soft">{label}</dt>
      <dd className="mt-2 font-medium text-foreground">{value}</dd>
    </div>
  );
}

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
    model: ModelCatalogEntry;
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
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
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
        focusMode ? "mx-auto w-full max-w-3xl shrink-0 pt-3" : "mt-5",
      )}
      data-testid="chat-composer"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit();
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

export function InspectorPanel({
  activeBranch,
  activeInspectorTab,
  branches,
  inspectorView,
  onRemovePin,
  onTabChange,
  pendingAction,
}: {
  activeBranch: ChatBranchRecord;
  activeInspectorTab: InspectorTab;
  branches: ChatBranchRecord[];
  inspectorView: ContinuityInspectorView;
  onRemovePin: (pinId: string) => Promise<void>;
  onTabChange: (tab: InspectorTab) => void;
  pendingAction: string | null;
}) {
  return (
    <section className="paper-panel rounded-[2rem] p-6">
      <div className="flex items-center gap-2 text-brand">
        <Sparkles className="h-4 w-4" />
        <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
          Continuity inspector
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {inspectorTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              activeInspectorTab === tab.id
                ? "border-brand bg-brand text-white"
                : "border-border bg-white/8 text-foreground hover:border-brand hover:text-brand",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {activeInspectorTab === "continuity" ? (
          <div className="space-y-4">
            {inspectorView.continuityStatus ? (
              <div className="rounded-[1.5rem] border border-brand/20 bg-brand/8 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-brand">
                  {inspectorView.continuityStatus.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-brand-strong">
                  {inspectorView.continuityStatus.detail}
                </p>
              </div>
            ) : null}
            {inspectorView.continuity.map((section) => (
              <div
                key={section.label}
                className="rounded-[1.5rem] border border-border bg-white/5 p-4"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                  {section.label}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {section.value}
                </p>
                <p className="mt-3 text-xs leading-6 text-ink-soft">{section.helper}</p>
              </div>
            ))}
          </div>
        ) : null}

        {activeInspectorTab === "pins" ? (
          <div className="space-y-4">
            {inspectorView.pins.length ? (
              inspectorView.pins.map((pin) => (
                <div
                  key={pin.id}
                  className="rounded-[1.5rem] border border-border bg-white/5 p-4"
                >
                  <p className="text-sm leading-7 text-foreground">{pin.body}</p>
                  <div className="mt-3 text-xs leading-6 text-ink-soft">
                    <p>{pin.sourceLabel}</p>
                    <p className="mt-1">{pin.sourceExcerpt}</p>
                    <p className="mt-1">{formatLongDateTime(pin.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => void onRemovePin(pin.id)}
                    className="mt-3 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-brand hover:text-brand"
                  >
                    Remove pin
                  </button>
                </div>
              ))
            ) : (
              <EmptyInspectorState>
                Pin branch-local facts from transcript messages when continuity needs a durable reminder.
              </EmptyInspectorState>
            )}
          </div>
        ) : null}

        {activeInspectorTab === "timeline" ? (
          <div className="space-y-4">
            {inspectorView.timeline.length ? (
              inspectorView.timeline.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[1.5rem] border border-border bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{event.title}</p>
                    <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                      importance {event.importance}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-foreground">{event.detail}</p>
                  <p className="mt-3 text-xs text-ink-soft">
                    {formatLongDateTime(event.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyInspectorState>
                Once the thread records notable beats, they will appear here in branch-local order.
              </EmptyInspectorState>
            )}
          </div>
        ) : null}

        {activeInspectorTab === "branch" ? (
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-border bg-white/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                Active branch
              </p>
              <p className="mt-2 font-semibold text-foreground">
                {inspectorView.branch.activeBranchName}
              </p>
              <dl className="mt-4 grid gap-3 text-sm text-foreground">
                <BranchMetric
                  label="Parent branch"
                  value={inspectorView.branch.parentBranchName ?? "Root branch"}
                />
                <BranchMetric
                  label="Fork checkpoint"
                  value={inspectorView.branch.forkCheckpointId ?? "Started at the root"}
                />
                <BranchMetric
                  label="Head checkpoint"
                  value={inspectorView.branch.headCheckpointId ?? "No assistant turn yet"}
                />
                <BranchMetric
                  label="Alternate replies"
                  value={String(inspectorView.branch.alternateCount)}
                />
                <BranchMetric
                  label="Total branches"
                  value={String(inspectorView.branch.totalBranches)}
                />
                <BranchMetric
                  label="Total checkpoints"
                  value={String(inspectorView.branch.totalCheckpoints)}
                />
              </dl>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-white/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                Available branches
              </p>
              <div className="mt-3 space-y-2">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm",
                      branch.id === activeBranch.id
                        ? "border-brand bg-brand/8 text-brand"
                        : "border-border bg-paper text-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{branch.name}</span>
                      {branch.id === activeBranch.id ? (
                        <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          active
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      Updated {formatLongDateTime(branch.updated_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ActionSheet({
  sheet,
  pendingAction,
  onClose,
  onSubmit,
}: {
  sheet: ActionSheetState;
  pendingAction: string | null;
  onClose: () => void;
  onSubmit: (value: string, alternateCheckpointId?: string) => Promise<void>;
}) {
  const [value, setValue] = useState(
    sheet.kind === "alternates" ? "" : sheet.value,
  );

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close action sheet"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute inset-x-3 bottom-5 mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-[#1a1412] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
        {sheet.kind === "alternates" ? (
          <>
            <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
              Alternate picker
            </p>
            <h3 className="mt-3 font-serif text-3xl text-foreground">Choose the canonical reply</h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">
              Selecting an alternate moves this branch head to a different sibling reply for the same latest user turn.
            </p>
            <div className="mt-5 space-y-3">
              {sheet.control.alternates.map((alternate) => (
                <button
                  key={alternate.checkpointId}
                  type="button"
                  disabled={pendingAction !== null || alternate.selected}
                  onClick={() => void onSubmit("", alternate.checkpointId)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[1.5rem] border px-4 py-4 text-left transition disabled:opacity-60",
                    alternate.selected
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-paper text-foreground hover:border-brand hover:text-brand",
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold">{alternate.label}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-ink-soft">
                      {alternate.selected ? "Current branch head" : "Switch this branch to this reply"}
                    </span>
                  </span>
                  {alternate.selected ? <CheckCircle2 className="h-4 w-4" /> : <MessageCircleMore className="h-4 w-4" />}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const trimmed = value.trim();
              if (!trimmed) return;
              await onSubmit(trimmed);
            }}
          >
            <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
              {sheet.kind === "edit"
                ? "Edit last user turn"
                : sheet.kind === "branch"
                  ? "Branch from checkpoint"
                  : "Pin fact"}
            </p>
            <h3 className="mt-3 font-serif text-3xl text-foreground">
              {sheet.kind === "edit"
                ? "Fork a fresh version of that user turn"
                : sheet.kind === "branch"
                  ? "Name the new branch"
                  : "Save a branch-local memory"}
            </h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">
              {sheet.kind === "edit"
                ? "Saving this does not rewrite history. It creates a new branch from the point before that user turn and generates a new assistant reply."
                : sheet.kind === "branch"
                  ? "This creates a clean future path from the selected checkpoint without disturbing the current branch."
                  : "Pinned facts stay local to the active branch and influence future replies on this path only."}
            </p>

            {sheet.kind === "branch" ? (
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="mt-5 w-full rounded-[1.5rem] border border-border bg-paper px-4 py-4 text-sm outline-none transition focus:border-brand"
                placeholder="branch-2"
              />
            ) : (
              <textarea
                rows={sheet.kind === "edit" ? 6 : 5}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="mt-5 w-full rounded-[1.5rem] border border-border bg-paper px-4 py-4 text-sm leading-7 outline-none transition focus:border-brand"
              />
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pendingAction !== null}
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
              >
                {pendingAction !== null
                  ? "Working..."
                  : sheet.kind === "edit"
                    ? "Create edited branch"
                    : sheet.kind === "branch"
                      ? "Create branch"
                      : "Save pin"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function ActionButton({
  children,
  disabled,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  icon: LucideIcon;
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
