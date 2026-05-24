"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { cn, formatLongDateTime } from "@/lib/utils";
import type {
  ChatBranchRecord,
  ContinuityInspectorView,
} from "@/lib/types";
import {
  type InspectorTab,
  inspectorTabs,
} from "@/components/chat/chat-ui-types";

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
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Available branches
              </p>
              <div className="mt-2 space-y-1">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className={cn(
                      "rounded border px-3 py-2 text-xs",
                      branch.id === activeBranch.id
                        ? "border-primary-container/30 bg-primary-container/10 text-primary-container"
                        : "border-border-subtle bg-surface-container text-on-surface",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{branch.name}</span>
                      {branch.id === activeBranch.id ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-[0.05em]">
                          <CheckCircle2 className="h-3 w-3" />
                          active
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
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
