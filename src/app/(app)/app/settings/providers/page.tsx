import { providerCatalog } from "@/lib/ai/catalog";
import { requireAllowedUser } from "@/lib/auth";
import { listConnections } from "@/lib/data/connections";
import {
  deleteConnectionAction,
  saveConnectionAction,
} from "@/app/(app)/app/settings/providers/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { ProviderConnectionForm } from "@/components/settings/provider-connection-form";
import { ProviderHealthActions } from "@/components/settings/provider-health-actions";
import { formatDateTime } from "@/lib/utils";

function humanizeProviderReason(reason: string) {
  if (!reason) return "";
  if (reason === "connection") return "Add a provider, test it, and refresh models first.";
  if (reason.toLowerCase().includes("requires an api key")) return reason;
  if (reason.toLowerCase().includes("connection label")) return "Give the lane a label.";
  return reason;
}

function healthBadgeClass(status: string) {
  if (status === "healthy") return "border-status-success/30 bg-status-success/10 text-status-success";
  if (status === "untested") return "border-status-unknown/30 bg-status-unknown/10 text-status-unknown";
  if (status === "rate_limited") return "border-status-warning/30 bg-status-warning/10 text-status-warning";
  return "border-status-critical/30 bg-status-critical/10 text-status-critical";
}

export default async function ProviderSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireAllowedUser();
  const connections = await listConnections(supabase, user.id);
  const reason = typeof params.reason === "string" ? params.reason : null;
  const saved = params.saved === "1";
  const deleted = params.deleted === "1";

  return (
    <div className="space-y-4">
      {/* Header */}
      <h1 className="font-display text-xl font-bold text-on-surface">Providers</h1>

      {/* Banners */}
      {reason && (
        <div className="rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-medium text-status-warning">
          {humanizeProviderReason(reason)}
        </div>
      )}
      {saved && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Provider saved. Test it next.
        </div>
      )}
      {deleted && (
        <div className="rounded border border-status-success/30 bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
          Provider removed.
        </div>
      )}

      {/* New connection form */}
      <section className="rounded-lg border border-border-subtle bg-background-front p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Add new lane
        </p>
        <div className="mt-3">
          <ProviderConnectionForm
            action={saveConnectionAction}
            submitLabel="Save connection"
          />
        </div>
      </section>

      {/* Connection cards */}
      <section className="space-y-2">
        {connections.length ? (
          connections.map((connection) => (
            <article
              key={connection.id}
              className="rounded-lg border border-border-subtle bg-background-front p-4"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-on-surface">{connection.label}</p>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${healthBadgeClass(connection.health_status)}`}
                    >
                      {connection.health_status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {providerCatalog[connection.provider].name}
                  </p>
                </div>
                <ProviderHealthActions connectionId={connection.id} />
              </div>

              {/* Health info */}
              <p className="mt-2 text-xs text-muted-foreground">
                {connection.health_message || providerCatalog[connection.provider].description}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {connection.base_url ? `URL: ${connection.base_url}` : "Default endpoint"}
                {" · "}Tested {formatDateTime(connection.last_checked_at)}
                {" · "}Refreshed {formatDateTime(connection.last_model_refresh_at)}
              </p>

              {/* Cached models */}
              {connection.model_cache.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {connection.model_cache.slice(0, 12).map((model) => (
                    <span
                      key={model.id}
                      className="rounded border border-border-subtle bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant"
                    >
                      {model.name}
                    </span>
                  ))}
                  {connection.model_cache.length > 12 && (
                    <span className="rounded px-2 py-0.5 text-[10px] text-muted-foreground">
                      +{connection.model_cache.length - 12} more
                    </span>
                  )}
                </div>
              )}

              {/* Edit form (collapsible) */}
              <details className="mt-3 rounded border border-border-subtle bg-surface-container-low px-3 py-2">
                <summary className="cursor-pointer list-none text-xs font-semibold text-on-surface-variant">
                  Edit lane
                </summary>
                <div className="mt-3">
                  <ProviderConnectionForm
                    action={saveConnectionAction}
                    submitLabel="Save changes"
                    connectionId={connection.id}
                    initialProvider={connection.provider}
                    initialLabel={connection.label}
                    initialBaseUrl={connection.base_url ?? ""}
                    initialEnabled={connection.enabled}
                    keyPlaceholder={
                      connection.encrypted_api_key
                        ? "Leave blank to keep the current secret"
                        : "Stored encrypted"
                    }
                    hasStoredSecret={Boolean(connection.encrypted_api_key)}
                  />
                </div>
              </details>

              <form action={deleteConnectionAction} className="mt-2">
                <input type="hidden" name="id" value={connection.id} />
                <ConfirmSubmitButton
                  confirmMessage="Delete this provider lane?"
                  className="rounded bg-status-critical/10 border border-status-critical/30 px-2 py-1 text-xs font-semibold text-status-critical"
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border-subtle bg-surface-container-low p-6 text-center text-sm text-muted-foreground">
            No providers configured yet. Add one above.
          </div>
        )}
      </section>
    </div>
  );
}
