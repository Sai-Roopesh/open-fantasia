"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  createContext,
  use,
  useMemo,
  useReducer,
  type ActionDispatch,
  type ReactNode,
} from "react";
import { getTextFromMessage } from "@/lib/ai/message-text";
import { messageMetadataSchema, type FantasiaUIMessage } from "@/lib/types";
import {
  chatStoreReducer,
  initChatStore,
  type ChatStoreAction,
  type ChatStoreSeed,
  type ChatStoreState,
} from "@/components/chat/chat-store";

type ChatContextValue = {
  threadId: string;
  chat: Chat<FantasiaUIMessage>;
  state: ChatStoreState;
  dispatch: ActionDispatch<[action: ChatStoreAction]>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const value = use(ChatContext);
  if (!value) {
    throw new Error("useChatContext must be used within a ChatProvider.");
  }
  return value;
}

/**
 * Seeds the chat store and owns the AI SDK `Chat` streaming instance.
 *
 * The store and the `Chat` instance are seeded once from the server snapshot.
 * After mount, the transcript is updated only by streaming (the SDK) and explicit
 * `chat.setMessages` reconciliation; auxiliary state is updated only by applying
 * mutation slices. There is no prop→state re-sync effect, which is what removes
 * the old staleness/flash races. A fresh thread remounts this provider via a
 * `key={threadId}` on the workspace, so per-thread state always seeds clean.
 */
export function ChatProvider({
  threadId,
  initialMessages,
  seed,
  children,
}: {
  threadId: string;
  initialMessages: FantasiaUIMessage[];
  seed: ChatStoreSeed;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(chatStoreReducer, seed, initChatStore);

  const chat = useMemo(
    () =>
      new Chat<FantasiaUIMessage>({
        id: threadId,
        messages: initialMessages,
        messageMetadataSchema,
        transport: new DefaultChatTransport({
          api: "/api/chat",
          body: { threadId },
          prepareSendMessagesRequest({ body, messages }) {
            const latestUserMessage = [...messages]
              .reverse()
              .find((message) => message.role === "user");

            return {
              body: {
                threadId: body?.threadId,
                branchId: body?.branchId,
                expectedHeadTurnId: body?.expectedHeadTurnId,
                mode: body?.mode ?? "new",
                text: latestUserMessage ? getTextFromMessage(latestUserMessage) : "",
              },
            };
          },
        }),
      }),
    // Intentionally only keyed on threadId — see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadId],
  );

  const value = useMemo<ChatContextValue>(
    () => ({ threadId, chat, state, dispatch }),
    [threadId, chat, state],
  );

  return <ChatContext value={value}>{children}</ChatContext>;
}
