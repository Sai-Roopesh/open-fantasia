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
    <p className="rounded-[1.5rem] border border-dashed border-border px-4 py-4 text-sm leading-7 text-ink-soft">
      {children}
    </p>
  );
}

function BranchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-paper px-4 py-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-ink-soft">{label}</dt>
      <dd className="mt-2 font-medium text-foreground">{value}</dd>
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
              <div
                className={cn(
                  "rounded-[1.5rem] p-4",
                  inspectorView.continuityStatus.tone === "error"
                    ? "border border-red-900/40 bg-red-950/35"
                    : "border border-brand/20 bg-brand/8",
                )}
              >
                <p
                  className={cn(
                    "text-xs uppercase tracking-[0.18em]",
                    inspectorView.continuityStatus.tone === "error"
                      ? "text-red-300"
                      : "text-brand",
                  )}
                >
                  {inspectorView.continuityStatus.title}
                </p>
                <p
                  className={cn(
                    "mt-2 text-sm leading-7",
                    inspectorView.continuityStatus.tone === "error"
                      ? "text-red-100"
                      : "text-brand-strong",
                  )}
                >
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
            <div className="rounded-[1.5rem] border border-border bg-white/5 p-4">
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
                  label="Fork turn"
                  value={inspectorView.branch.forkTurnId ?? "Started at the root"}
                />
                <BranchMetric
                  label="Head turn"
                  value={inspectorView.branch.headTurnId ?? "No assistant turn yet"}
                />
                <BranchMetric
                  label="Total branches"
                  value={String(inspectorView.branch.totalBranches)}
                />
                <BranchMetric
                  label="Total turns"
                  value={String(inspectorView.branch.totalTurns)}
                />
              </dl>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-white/5 p-4">
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
