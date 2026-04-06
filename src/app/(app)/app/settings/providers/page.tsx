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
  if (reason === "connection") {
    return "Add at least one enabled provider lane, test it, and refresh models before starting a thread.";
  }
  if (reason.toLowerCase().includes("requires an api key")) {
    return reason;
  }
  if (reason.toLowerCase().includes("connection label")) {
    return "Give the lane a label so it is recognizable when you switch models inside a thread.";
  }
  return reason;
}

function healthBadge(status: string) {
  if (status === "healthy") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "untested") {
    return "bg-slate-200 text-slate-700";
  }
  if (status === "rate_limited") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-rose-100 text-rose-700";
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
    <div className="space-y-8">
      <section className="paper-panel rounded-[2rem] p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">
          Provider settings
        </p>
        <h1 className="mt-3 font-serif text-5xl text-foreground">
          Verify the lane before you trust it with a scene.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft">
          Save a connection, test it, then refresh models. Fantasia keeps the health state visible
          so you can tell the difference between an untested lane, a bad key, and a rate-limited
          quota before a thread gets interrupted mid-scene.
        </p>

        {reason ? (
          <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {humanizeProviderReason(reason)}
          </div>
        ) : null}
        {saved ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Provider lane saved. Test it next so the workspace knows whether it is actually usable.
          </div>
        ) : null}
        {deleted ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Provider lane removed from the workspace.
          </div>
        ) : null}
      </section>

      <section className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="paper-panel rounded-[2rem] p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">New lane</p>
          <div className="mt-4 space-y-4">
            <ProviderConnectionForm
              action={saveConnectionAction}
              submitLabel="Save connection"
            />
          </div>
        </div>

        <div className="space-y-4">
          {connections.length ? (
            connections.map((connection) => (
              <article key={connection.id} className="paper-panel rounded-[2rem] p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-lg">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                        {providerCatalog[connection.provider].name}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${healthBadge(connection.health_status)}`}
                      >
                        {connection.health_status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <h2 className="mt-2 font-serif text-3xl text-foreground">
                      {connection.label}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-ink-soft">
                      {connection.health_message || providerCatalog[connection.provider].description}
                    </p>
                    <p className="mt-3 text-xs leading-6 text-ink-soft">
                      {connection.base_url
                        ? `Base URL: ${connection.base_url}`
                        : "Using the default endpoint for this provider."}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-ink-soft">
                      Tested {formatDateTime(connection.last_checked_at)} • Refreshed{" "}
                      {formatDateTime(connection.last_model_refresh_at)}
                    </p>
                  </div>

                  <ProviderHealthActions connectionId={connection.id} />
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                    Cached models
                  </p>
                  {connection.model_cache.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {connection.model_cache.slice(0, 16).map((model) => (
                        <span
                          key={model.id}
                          className="rounded-full border border-border bg-paper px-3 py-1 text-xs text-foreground"
                        >
                          {model.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-7 text-ink-soft">
                      No model cache yet. Run connection test first, then refresh models once the key is healthy.
                    </p>
                  )}
                </div>

                <div className="mt-6 rounded-[1.6rem] border border-border bg-[#fffaf4] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">Edit lane</p>
                  <div className="mt-4">
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
                </div>

                <form action={deleteConnectionAction} className="mt-4">
                  <input type="hidden" name="id" value={connection.id} />
                  <ConfirmSubmitButton
                    confirmMessage="Delete this provider lane and remove it from all future thread selection?"
                    className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    Delete connection
                  </ConfirmSubmitButton>
                </form>
              </article>
            ))
          ) : (
            <div className="paper-panel rounded-[2rem] p-8 text-sm leading-7 text-ink-soft">
              No providers configured yet. Add one lane, verify it, then refresh the models you
              want available in the thread switcher.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
