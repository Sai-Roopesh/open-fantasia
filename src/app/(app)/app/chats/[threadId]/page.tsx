import { notFound, redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { resolveCharacterPortraitUrl } from "@/lib/data/characters";
import { requireAllowedUser } from "@/lib/auth";
import { listConnections } from "@/lib/data/connections";
import { listPersonas } from "@/lib/data/personas";
import { buildInspectorView, buildThreadSettingsSlice } from "@/lib/domain/slice-projections";
import { buildCanonicalMessages, buildControlsByMessageId } from "@/lib/domain/turn-projections";
import { loadThreadAssemblyWithSnapshot } from "@/lib/services/thread-reader";
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

  const [assembled, connections, personas] = await Promise.all([
    loadThreadAssemblyWithSnapshot(supabase, user.id, threadId),
    listConnections(supabase, user.id),
    listPersonas(supabase, user.id),
  ]);

  if (!assembled) {
    notFound();
  }

  const { assembly, snapshot } = assembled;
  const character = assembly.characterBundle;

  if (!character) {
    redirect("/app/characters");
  }
  if (!assembly.thread.persona_id) {
    redirect("/app/personas?reason=default");
  }
  const characterBackgroundUrl = resolveCharacterPortraitUrl(
    supabase,
    character.character.portrait_path,
  );

  const currentConnection = connections.find((c) => c.id === assembly.thread.connection_id);
  if (!currentConnection) {
    redirect("/app/settings/providers?reason=connection");
  }

  const currentPersona = personas.find((p) => p.id === assembly.thread.persona_id);
  if (!currentPersona) {
    redirect("/app/personas?reason=default");
  }

  const inspectorView = buildInspectorView(assembly, snapshot);
  const settings = buildThreadSettingsSlice(assembly, connections);

  return (
    <ChatWorkspace
      key={assembly.thread.id}
      threadId={assembly.thread.id}
      characterName={character.character.name}
      characterBackgroundUrl={characterBackgroundUrl}
      activeBranch={assembly.activeBranch}
      branches={assembly.branches}
      personas={personas}
      initialMessages={buildCanonicalMessages(assembly.turns)}
      controlsByMessageId={buildControlsByMessageId(assembly.turns)}
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
