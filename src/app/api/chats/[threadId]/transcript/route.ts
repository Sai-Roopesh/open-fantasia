import { getCurrentUser } from "@/lib/auth";
import { buildPlainTextTranscript } from "@/lib/domain/turn-projections";
import { loadThreadAssembly } from "@/lib/services/thread-reader";

/**
 * Returns the active branch's visible transcript as plain text, for the
 * "copy whole branch" action. Hidden turns are omitted.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const assembly = await loadThreadAssembly(context.supabase, context.user.id, threadId);
  if (!assembly) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const transcript = buildPlainTextTranscript(
    assembly.turns,
    assembly.characterBundle?.character.name ?? "Character",
  );

  return Response.json({ ok: true, transcript });
}
