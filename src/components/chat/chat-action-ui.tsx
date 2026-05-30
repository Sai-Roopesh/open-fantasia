"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { ActionSheetState } from "@/components/chat/chat-ui-types";

type SheetCopy = {
  eyebrow: string;
  title: string;
  description: string;
  submitLabel: string;
  /** Whether an empty value may be submitted (regenerate guidance is optional). */
  allowEmpty: boolean;
};

function sheetCopy(sheet: ActionSheetState): SheetCopy {
  switch (sheet.kind) {
    case "edit":
      return sheet.target === "assistant"
        ? {
            eyebrow: "Edit latest reply",
            title: "Rewrite the latest reply",
            description: "Replaces the latest reply and re-runs continuity.",
            submitLabel: "Rewrite reply",
            allowEmpty: false,
          }
        : {
            eyebrow: "Edit last user turn",
            title: "Rewrite the latest turn",
            description: "Rewrites the user turn and regenerates the reply.",
            submitLabel: "Rewrite turn",
            allowEmpty: false,
          };
    case "branch":
      return {
        eyebrow: "Branch from turn",
        title: "Name the new branch",
        description: "Forks a new branch from the selected turn.",
        submitLabel: "Create branch",
        allowEmpty: false,
      };
    case "pin":
      return {
        eyebrow: "Pin fact",
        title: "Save a branch-local memory",
        description: "Pinned facts stay local to the active branch.",
        submitLabel: "Save pin",
        allowEmpty: false,
      };
    case "regenerate":
      return {
        eyebrow: "Regenerate reply",
        title: "Steer the new reply (optional)",
        description:
          "Describe how the regenerated reply should differ. Leave blank to simply regenerate from the same turn.",
        submitLabel: "Regenerate",
        allowEmpty: true,
      };
  }
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
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(sheet.value);
  const copy = sheetCopy(sheet);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close action sheet"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute inset-x-3 bottom-4 mx-auto max-w-xl rounded-lg border border-border-subtle bg-surface-container-low p-4">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const trimmed = value.trim();
            if (!trimmed && !copy.allowEmpty) return;
            await onSubmit(trimmed);
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-on-surface">{copy.title}</h3>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">{copy.description}</p>

          {sheet.kind === "branch" ? (
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-3 w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
              placeholder="branch-2"
            />
          ) : (
            <textarea
              rows={sheet.kind === "edit" ? 5 : 4}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus={sheet.kind === "regenerate"}
              className="mt-3 w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm leading-6 text-on-surface outline-none focus:border-primary-container"
            />
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pendingAction !== null}
              className="rounded bg-primary-container px-3 py-1.5 text-xs font-semibold text-on-primary-container disabled:opacity-50"
            >
              {pendingAction !== null ? "Working..." : copy.submitLabel}
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
      className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface-variant disabled:opacity-50"
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}
