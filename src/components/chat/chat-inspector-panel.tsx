"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, Copy, GitBranch, Sparkles } from "lucide-react";
import { cn, formatLongDateTime } from "@/lib/utils";
import type { BranchTreeNode, ContinuityInspectorView } from "@/lib/types";
import {
  type InspectorTab,
  inspectorTabs,
} from "@/components/chat/chat-ui-types";

/**
 * Recursive git-style branch tree. Each node is a button that switches to that
 * branch on click; the active branch is highlighted and non-interactive.
 */
function BranchTreeView({
  nodes,
  depth,
  activeBranchId,
  switchPending,
  onSwitchBranch,
}: {
  nodes: BranchTreeNode[];
  depth: number;
  activeBranchId: string;
  switchPending: boolean;
  onSwitchBranch: (branchId: string) => void;
}) {
  return (
    <ul className={cn(depth > 0 && "ml-3 border-l border-border-subtle pl-2")}>
      {nodes.map((node) => {
        const isActive = node.id === activeBranchId;
        return (
          <li key={node.id} className="mt-1 first:mt-0">
            <button
              type="button"
              disabled={isActive || switchPending}
              onClick={() => onSwitchBranch(node.id)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs",
                isActive
                  ? "bg-primary-container/10 text-primary-container"
                  : "bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-50",
              )}
            >
              <GitBranch className="h-3 w-3 shrink-0" />
              <span className="flex-1 truncate font-semibold">{node.name}</span>
              {isActive ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-[0.05em]">
                  <CheckCircle2 className="h-3 w-3" />
                  active
                </span>
              ) : null}
            </button>
            {node.children.length ? (
              <BranchTreeView
                nodes={node.children}
                depth={depth + 1}
                activeBranchId={activeBranchId}
                switchPending={switchPending}
                onSwitchBranch={onSwitchBranch}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function EmptyInspectorState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded border border-dashed border-border-subtle px-3 py-3 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function BranchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-subtle bg-surface-container px-3 py-2">
      <dt className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs font-medium text-on-surface">{value}</dd>
    </div>
  );
}

export function InspectorPanel({
  activeInspectorTab,
  branchTree,
  displayBranchId,
  switchPending,
  inspectorView,
  onRemovePin,
  onSwitchBranch,
  onCopyTranscript,
  onTabChange,
  pendingAction,
}: {
  activeInspectorTab: InspectorTab;
  branchTree: BranchTreeNode[];
  displayBranchId: string;
  switchPending: boolean;
  inspectorView: ContinuityInspectorView;
  onRemovePin: (pinId: string) => Promise<void>;
  onSwitchBranch: (branchId: string) => void;
  onCopyTranscript: () => Promise<string>;
  onTabChange: (tab: InspectorTab) => void;
  pendingAction: string | null;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      const transcript = await onCopyTranscript();
      await navigator.clipboard.writeText(transcript);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 2000);
  }
  return (
    <section className="rounded-lg border border-border-subtle bg-background-front p-4">
      <div className="flex items-center gap-1.5 text-primary-container">
        <Sparkles className="h-3.5 w-3.5" />
        <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Continuity inspector
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {inspectorTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-semibold",
              activeInspectorTab === tab.id
                ? "bg-primary-container text-on-primary-container"
                : "bg-surface-container-high text-on-surface-variant",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {activeInspectorTab === "continuity" ? (
          <div className="space-y-2">
            {inspectorView.continuityStatus ? (
              <div
                className={cn(
                  "rounded border p-3",
                  inspectorView.continuityStatus.tone === "error"
                    ? "border-status-critical/30 bg-status-critical/10"
                    : "border-status-warning/30 bg-status-warning/10",
                )}
              >
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.05em]",
                    inspectorView.continuityStatus.tone === "error"
                      ? "text-status-critical"
                      : "text-status-warning",
                  )}
                >
                  {inspectorView.continuityStatus.title}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs leading-4",
                    inspectorView.continuityStatus.tone === "error"
                      ? "text-status-critical"
                      : "text-status-warning",
                  )}
                >
                  {inspectorView.continuityStatus.detail}
                </p>
              </div>
            ) : null}
            {inspectorView.continuity.map((section) => (
              <div
                key={section.label}
                className="rounded border border-border-subtle bg-surface-container-low p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  {section.label}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-4 text-on-surface">
                  {section.value}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">{section.helper}</p>
              </div>
            ))}
          </div>
        ) : null}

        {activeInspectorTab === "pins" ? (
          <div className="space-y-2">
            {inspectorView.pins.length ? (
              inspectorView.pins.map((pin) => (
                <div
                  key={pin.id}
                  className="rounded border border-border-subtle bg-surface-container-low p-3"
                >
                  <p className="text-xs leading-4 text-on-surface">{pin.body}</p>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    <p>{pin.sourceLabel}</p>
                    <p className="mt-0.5">{pin.sourceExcerpt}</p>
                    <p className="mt-0.5">{formatLongDateTime(pin.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => void onRemovePin(pin.id)}
                    className="mt-2 rounded bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface-variant"
                  >
                    Remove pin
                  </button>
                </div>
              ))
            ) : (
              <EmptyInspectorState>
                Pin branch-local facts from transcript messages.
              </EmptyInspectorState>
            )}
          </div>
        ) : null}

        {activeInspectorTab === "timeline" ? (
          <div className="space-y-2">
            {inspectorView.timeline.length ? (
              inspectorView.timeline.map((event) => (
                <div
                  key={event.id}
                  className="rounded border border-border-subtle bg-surface-container-low p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-on-surface">{event.title}</p>
                    <span className="rounded bg-primary-container/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary-container">
                      imp {event.importance}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-4 text-on-surface-variant">{event.detail}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatLongDateTime(event.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyInspectorState>
                Notable beats will appear here once the thread records them.
              </EmptyInspectorState>
            )}
          </div>
        ) : null}

        {activeInspectorTab === "branch" ? (
          <div className="space-y-2">
            <div className="rounded border border-border-subtle bg-surface-container-low p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Active branch
              </p>
              <p className="mt-0.5 text-xs font-semibold text-on-surface">
                {inspectorView.branch.activeBranchName}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-on-surface">
                <BranchMetric
                  label="Parent"
                  value={inspectorView.branch.parentBranchName ?? "Root"}
                />
                <BranchMetric
                  label="Fork turn"
                  value={inspectorView.branch.forkTurnId ?? "Root"}
                />
                <BranchMetric
                  label="Head turn"
                  value={inspectorView.branch.headTurnId ?? "None"}
                />
                <BranchMetric
                  label="Branches"
                  value={String(inspectorView.branch.totalBranches)}
                />
                <BranchMetric
                  label="Turns"
                  value={String(inspectorView.branch.totalTurns)}
                />
              </dl>
            </div>

            <div className="rounded border border-border-subtle bg-surface-container-low p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Branch tree
                </p>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-[10px] font-semibold text-on-surface-variant"
                >
                  <Copy className="h-3 w-3" />
                  {copyState === "copied"
                    ? "Copied!"
                    : copyState === "error"
                      ? "Copy failed"
                      : "Copy branch"}
                </button>
              </div>
              <div className="mt-2">
                {branchTree.length ? (
                  <BranchTreeView
                    nodes={branchTree}
                    depth={0}
                    activeBranchId={displayBranchId}
                    switchPending={switchPending}
                    onSwitchBranch={onSwitchBranch}
                  />
                ) : (
                  <EmptyInspectorState>No branches yet.</EmptyInspectorState>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
