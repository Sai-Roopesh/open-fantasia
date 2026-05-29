import { notFound, redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { resolveCharacterPortraitUrl } from "@/lib/characters/portraits";
import { requireAllowedUser } from "@/lib/auth";
import { listConnections } from "@/lib/data/connections";
import { listPersonas } from "@/lib/data/personas";
import {
  buildInspectorView,
  buildThreadSettingsSlice,
  getThreadGraphView,
} from "@/lib/threads/read-model";
import {
  switchThreadBranchAction,
  switchThreadModelAction,
  switchThreadPersonaAction,
  switchThreadBrainModelAction,
  switchThreadTokensAction,
} from "@/app/(app)/app/chats/[threadId]/actions";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const { supabase, user } = await requireAllowedUser();

  const threadViewPromise = getThreadGraphView(supabase, user.id, threadId);
  const connectionsPromise = listConnections(supabase, user.id);
  const personasPromise = listPersonas(supabase, user.id);
  const [threadView, connections, personas] = await Promise.all([
    threadViewPromise,
    connectionsPromise,
    personasPromise,
  ]);

  if (!threadView) {
    notFound();
  }
  const view = threadView;
  const character = view.characterBundle;

  if (!character) {
    redirect("/app/characters");
  }
  if (!view.thread.persona_id) {
    redirect("/app/personas?reason=default");
  }
  const characterBackgroundUrl = resolveCharacterPortraitUrl(
    supabase,
    character.character.portrait_path,
  );

  const currentConnection = connections.find(
    (connection) => connection.id === view.thread.connection_id,
  );
  if (!currentConnection) {
    redirect("/app/settings/providers?reason=connection");
  }

  const currentPersona = personas.find(
    (persona) => persona.id === view.thread.persona_id,
  );
  if (!currentPersona) {
    redirect("/app/personas?reason=default");
  }

  const inspectorView = buildInspectorView(view);
  const settings = buildThreadSettingsSlice(view, connections);

  return (
    <ChatWorkspace
      key={view.thread.id}
      threadId={view.thread.id}
      characterName={character.character.name}
      characterBackgroundUrl={characterBackgroundUrl}
      activeBranch={view.activeBranch}
      branches={view.branches}
      personas={personas}
      initialMessages={view.canonicalMessages}
      controlsByMessageId={view.controlsByMessageId}
      inspectorView={inspectorView}
      settings={settings}
      suggestedStarters={character.starters.map((starter) => starter.text)}
      modelChoices={connections
        .filter((connection) => connection.enabled && connection.model_cache.length > 0)
        .map((connection) => ({
          connectionId: connection.id,
          label: connection.label,
          provider: connection.provider,
          models: connection.model_cache,
        }))}
      switchModelAction={switchThreadModelAction}
      switchBranchAction={switchThreadBranchAction}
      switchPersonaAction={switchThreadPersonaAction}
      switchBrainModelAction={switchThreadBrainModelAction}
      switchTokensAction={switchThreadTokensAction}
    />
  );
}
