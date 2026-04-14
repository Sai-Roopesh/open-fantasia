"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { ActionSheetState } from "@/components/chat/chat-ui-types";

export function ActionSheet({
  sheet,
  pendingAction,
  onClose,
  onSubmit,
}: {
  sheet: ActionSheetState;
  pendingAction: string | null;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(sheet.value);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close action sheet"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute inset-x-3 bottom-5 mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-[#1a1412] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
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
              ? "Rewrite the latest turn"
              : sheet.kind === "branch"
                ? "Name the new branch"
                : "Save a branch-local memory"}
          </h3>
          <p className="mt-3 text-sm leading-7 text-ink-soft">
            {sheet.kind === "edit"
              ? "Saving this rewrites the latest visible user turn and regenerates the assistant reply on the current branch."
              : sheet.kind === "branch"
                ? "This forks a new branch from the selected user turn and switches you onto that path."
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
                  ? "Rewrite turn"
                  : sheet.kind === "branch"
                    ? "Create branch"
                    : "Save pin"}
            </button>
          </div>
        </form>
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
  children: ReactNode;
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
