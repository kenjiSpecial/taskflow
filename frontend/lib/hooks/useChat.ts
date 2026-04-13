"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  createConversation,
  fetchChatMessages,
  addChatMessage,
} from "@/lib/api";
import type { CreateChatMessageInput, ChatMessageRecord } from "@/lib/types";

const STORAGE_KEY = "taskflow-chat-conversation-id";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

interface ToolExecution {
  tool_call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  status: "executing" | "done" | "cancelled" | "error";
  result?: unknown;
}

/**
 * 会話の永続化を管理するフック。
 * - マウント時にlocalStorageからconversation_idを復元し、メッセージをロード
 * - saveMessage()でDBに即保存（fire-and-forget）
 * - newConversation()でリセット
 */
export function useChatPersistence() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restoredMessages, setRestoredMessages] = useState<ChatMessage[]>([]);
  const [restoredToolExecutions, setRestoredToolExecutions] = useState<
    ToolExecution[]
  >([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const conversationIdRef = useRef<string | null>(null);

  // マウント時に復元
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setIsRestoring(false);
      return;
    }

    conversationIdRef.current = saved;
    setConversationId(saved);

    void fetchChatMessages(saved)
      .then(({ messages: records }) => {
        const msgs: ChatMessage[] = [];
        const tools: ToolExecution[] = [];

        for (const rec of records) {
          if (rec.role === "user" || (rec.role === "assistant" && rec.content && !rec.tool_calls)) {
            msgs.push({
              id: rec.id,
              role: rec.role,
              content: rec.content ?? "",
            });
          } else if (rec.role === "assistant" && rec.tool_calls) {
            // ツール呼び出し
            try {
              const calls = JSON.parse(rec.tool_calls) as Array<{
                tool_name: string;
                args: Record<string, unknown>;
              }>;
              for (const call of calls) {
                tools.push({
                  tool_call_id: rec.tool_call_id ?? rec.id,
                  tool_name: call.tool_name,
                  args: call.args,
                  status: "done",
                });
              }
            } catch {
              // ignore parse errors
            }
          } else if (rec.role === "tool") {
            // ツール結果 — 対応するtoolExecutionのresultを更新
            const te = tools.find(
              (t) => t.tool_call_id === rec.tool_call_id
            );
            if (te) {
              try {
                te.result = rec.content ? JSON.parse(rec.content) : undefined;
              } catch {
                te.result = rec.content;
              }
            }
          }
        }

        setRestoredMessages(msgs);
        setRestoredToolExecutions(tools);
      })
      .catch(() => {
        // 復元失敗（404等）→ クリア
        localStorage.removeItem(STORAGE_KEY);
        conversationIdRef.current = null;
        setConversationId(null);
      })
      .finally(() => {
        setIsRestoring(false);
      });
  }, []);

  // 会話が無い場合に作成
  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) return conversationIdRef.current;

    const { conversation } = await createConversation();
    const id = conversation.id;
    conversationIdRef.current = id;
    setConversationId(id);
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  }, []);

  // メッセージ保存（fire-and-forget）
  const saveMessage = useCallback(
    (data: CreateChatMessageInput) => {
      void (async () => {
        try {
          const id = await ensureConversation();
          await addChatMessage(id, data);
        } catch {
          // fire-and-forget: 保存失敗してもUIは止めない
        }
      })();
    },
    [ensureConversation]
  );

  // 新しい会話
  const newConversation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    conversationIdRef.current = null;
    setConversationId(null);
    setRestoredMessages([]);
    setRestoredToolExecutions([]);
  }, []);

  return {
    conversationId,
    restoredMessages,
    restoredToolExecutions,
    isRestoring,
    saveMessage,
    newConversation,
    ensureConversation,
  };
}
