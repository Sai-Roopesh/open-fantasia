import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { toThreadGenerationErrorResponse } from "@/lib/ai/generation-helpers";
import {
  streamNewTurn,
  streamRewriteTurn,
} from "@/lib/services/generation-service";
import { chatTurnRequestSchema, getValidationErrorMessage } from "@/lib/validation";
import { MAX_CHAT_TURN_TEXT, buildChatTurnLimitMessage } from "@/lib/chat-limits";

// The streaming turn closes as soon as the assistant text is committed; HCE
// materialization runs in the background via `after()`. This ceiling is headroom
// for a long generation plus that background pass (Vercel clamps to the plan max).
export const maxDuration = 60;

const chatRouteRequestSchema = z
  .object({
    threadId: z.string().uuid(),
    branchId: chatTurnRequestSchema.shape.branchId,
    expectedHeadTurnId: chatTurnRequestSchema.shape.expectedHeadTurnId,
    text: z.string().trim().max(MAX_CHAT_TURN_TEXT, buildChatTurnLimitMessage()).optional(),
    mode: z.enum(["new", "regenerate", "user"]).optional(),
    // Optional one-shot steering for a regenerate/user rewrite. Hidden from the
    // transcript and not persisted — it only shapes this regeneration.
    guidance: z.string().trim().max(MAX_CHAT_TURN_TEXT).optional(),
  })
  .refine(
    (data) => {
      if (data.mode !== "regenerate") {
        return typeof data.text === "string" && data.text.length > 0;
      }
      return true;
    },
    { message: "Write a message before sending.", path: ["text"] },
  )
  .refine(
    (data) => {
      if (data.mode === "regenerate" || data.mode === "user") {
        return typeof data.expectedHeadTurnId === "string" && data.expectedHeadTurnId.length > 0;
      }
      return true;
    },
    { message: "Expected head turn ID is required for rewrites.", path: ["expectedHeadTurnId"] },
  );

export async function POST(request: Request) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = chatRouteRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json(
      { error: getValidationErrorMessage(parsedBody.error, "Invalid chat payload.") },
      { status: 400 },
    );
  }

  const { branchId, expectedHeadTurnId, text, threadId, mode = "new", guidance } = parsedBody.data;

  try {
    if (mode === "new") {
      return streamNewTurn({
        supabase: context.supabase,
        userId: context.user.id,
        threadId,
        branchId,
        expectedHeadTurnId,
        text: text!,
      });
    }

    return streamRewriteTurn({
      supabase: context.supabase,
      userId: context.user.id,
      threadId,
      branchId,
      expectedHeadTurnId: expectedHeadTurnId!,
      text,
      mode,
      guidance,
    });
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }
}
