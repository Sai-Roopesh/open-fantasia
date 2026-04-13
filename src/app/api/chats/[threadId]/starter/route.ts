import { convertToModelMessages, generateText } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { finalizeAssistantTurn } from "@/lib/ai/turn-finalizer";
import { resolveThreadGenerationSettings } from "@/lib/ai/generation-settings";
import { getCharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import { createTextMessage, getThreadGraphView } from "@/lib/data/threads";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { scheduleBackgroundWorker } from "@/lib/jobs/kick-worker";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import { starterSeedRequestSchema } from "@/lib/validation";

function buildStarterSeedPrompt(starter: string) {
  return [
    "Use this as hidden scene guidance for your very first reply in the thread.",
    "This is not literal user dialogue, and it should not appear verbatim in the transcript unless you naturally adapt parts of it.",
    "Open the scene in character, establish the moment vividly, and leave room for the user to answer next.",
    "",
    `Starter seed: ${starter}`,
  ].join("\n");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = context.supabase;
  const user = context.user;
  const { threadId } = await params;
  const parsedBody = starterSeedRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return Response.json({ error: "A starter seed is required." }, { status: 400 });
  }

  const threadView = await getThreadGraphView(supabase, user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  if (threadView.checkpoints.length > 0) {
    return Response.json(
      { error: "Starter openings can only be used before the first turn." },
      { status: 400 },
    );
  }

  const [character, connection, persona] = await Promise.all([
    getCharacterBundle(supabase, user.id, threadView.thread.character_id),
    getConnection(supabase, user.id, threadView.thread.connection_id),
    threadView.thread.persona_id
      ? getPersona(supabase, user.id, threadView.thread.persona_id)
      : Promise.resolve(null),
  ]);

  if (!character || !connection || !persona) {
    return Response.json({ error: "Missing thread context." }, { status: 400 });
  }

  const starterMessage = createTextMessage({
    role: "user",
    text: buildStarterSeedPrompt(parsedBody.data.starter),
    metadata: {
      hiddenFromTranscript: true,
      starterSeed: true,
    },
  });
  const generationSettings = resolveThreadGenerationSettings({
    character: character.character,
    thread: threadView.thread,
  });

  const result = await generateText({
    model: createLanguageModel(connection, threadView.thread.model_id),
    system: buildRoleplaySystemPrompt({
      character,
      persona,
      snapshot: threadView.headSnapshot,
      pins: threadView.pins,
      timeline: [...threadView.timeline].reverse(),
    }),
    messages: await convertToModelMessages([
      ...threadView.modelContextMessages,
      starterMessage,
    ]),
    temperature: generationSettings.temperature,
    topP: generationSettings.topP,
    maxOutputTokens: generationSettings.maxOutputTokens,
  });

  const assistantMessage = createTextMessage({
    role: "assistant",
    text: result.text,
    metadata: {
      provider: connection.provider,
      model: threadView.thread.model_id,
      connectionLabel: connection.label,
      branchId: threadView.activeBranch.id,
      totalTokens: result.usage.totalTokens,
      finishReason: result.finishReason,
    },
  });

  const { checkpoint } = await finalizeAssistantTurn({
    supabase,
    userId: user.id,
    thread: threadView.thread,
    branchId: threadView.activeBranch.id,
    parentCheckpointId: threadView.activeBranch.head_checkpoint_id,
    userMessage: starterMessage,
    assistantMessage,
    choiceGroupKey: `choice:${crypto.randomUUID()}`,
    recentMessages: [
      ...threadView.modelContextMessages,
      starterMessage,
      assistantMessage,
    ],
  });
  scheduleBackgroundWorker(1);

  await insertTimelineEvent(supabase, {
    thread_id: threadId,
    branch_id: threadView.activeBranch.id,
    checkpoint_id: checkpoint.id,
    source_message_id: checkpoint.assistant_message_id,
    title: "Starter opening generated",
    detail: "Opened the scene from a seeded first-turn prompt.",
    importance: 2,
  });

  return Response.json({ ok: true, checkpointId: checkpoint.id });
}
