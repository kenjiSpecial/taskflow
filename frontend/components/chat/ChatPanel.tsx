"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageBubble } from "./MessageBubble";
import { ConfirmDialog } from "./ConfirmDialog";
import { ChatToggleButton } from "./ChatToggleButton";
import {
  bridgeChat,
  bridgeChatConfig,
  bridgeConfirm,
  bridgeSetModel,
} from "@/lib/bridge";
import { todoKeys } from "@/lib/hooks/useTodos";
import { projectKeys } from "@/lib/hooks/useProjects";
import { sessionKeys } from "@/lib/hooks/useSessions";
import { tagKeys } from "@/lib/hooks/useTags";

// --- Types ---

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

interface PendingConfirmation {
  tool_call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  description: string;
}

// --- Sub-components ---

function ToolExecutionIndicator({ te }: { te: ToolExecution }) {
  const label =
    te.status === "executing"
      ? `${te.tool_name} 実行中...`
      : te.status === "cancelled"
        ? `${te.tool_name} キャンセル`
        : te.status === "error"
          ? `${te.tool_name} エラー`
          : `${te.tool_name} 完了`;

  return (
    <div className={`chat-tool-indicator chat-tool-${te.status}`}>
      {te.status === "executing" && <span className="chat-spinner" />}
      <span>{label}</span>
    </div>
  );
}

// --- Main Component ---

export function ChatPanel() {
  const queryClient = useQueryClient();

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [chatModel, setChatModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [inputText, setInputText] = useState("");

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Use refs for streaming callbacks to avoid stale closures
  const streamingContentRef = useRef("");

  // Load chat config on mount
  useEffect(() => {
    void bridgeChatConfig()
      .then((c) => {
        setChatModel(c.model);
        setAvailableModels(c.availableModels);
      })
      .catch(() => {});
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent]);

  // Focus input when panel opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isChatOpen]);

  const invalidateAll = useCallback(() => {
    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: todoKeys.all }),
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
      queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
      queryClient.invalidateQueries({ queryKey: tagKeys.all }),
    ]);
  }, [queryClient]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setInputText("");
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");
    streamingContentRef.current = "";
    setError(null);
    setToolExecutions([]);

    const ctrl = bridgeChat(text, {
      onToken(content) {
        streamingContentRef.current += content;
        setStreamingContent(streamingContentRef.current);
      },
      onToolCall(data) {
        setToolExecutions((prev) => [
          ...prev,
          {
            tool_call_id: data.tool_call_id,
            tool_name: data.tool_name,
            args: data.args,
            status: "executing",
          },
        ]);
      },
      onToolResult(data) {
        if (data.cancelled) {
          setToolExecutions((prev) =>
            prev.map((te) =>
              te.tool_call_id === data.tool_call_id
                ? { ...te, status: "cancelled" as const }
                : te
            )
          );
        } else {
          setToolExecutions((prev) =>
            prev.map((te) =>
              te.tool_call_id === data.tool_call_id
                ? { ...te, status: "done" as const, result: data.result }
                : te
            )
          );
          invalidateAll();
        }
      },
      onConfirm(data) {
        setPendingConfirmation(data);
      },
      onDone(data) {
        if (data.model) {
          setChatModel(data.model);
        }
        const finalContent = streamingContentRef.current;
        if (finalContent) {
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: finalContent,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
        setStreamingContent("");
        streamingContentRef.current = "";
        setIsStreaming(false);
      },
      onError(data) {
        setError(data.message);
        const finalContent = streamingContentRef.current;
        if (finalContent) {
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: finalContent,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
        setStreamingContent("");
        streamingContentRef.current = "";
        setIsStreaming(false);
      },
    });

    abortRef.current = ctrl;
  }, [inputText, isStreaming, invalidateAll]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    const finalContent = streamingContentRef.current;
    if (finalContent) {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: finalContent,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }
    setStreamingContent("");
    streamingContentRef.current = "";
    setIsStreaming(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleConfirm = useCallback(
    async (approved: boolean) => {
      if (!pendingConfirmation) return;
      const toolCallId = pendingConfirmation.tool_call_id;
      setPendingConfirmation(null);
      await bridgeConfirm(toolCallId, approved);
    },
    [pendingConfirmation]
  );

  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setStreamingContent("");
    streamingContentRef.current = "";
    setError(null);
    setToolExecutions([]);
    setPendingConfirmation(null);
  }, []);

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newModel = e.target.value;
      const prev = chatModel;
      setChatModel(newModel);
      void bridgeSetModel(newModel).catch(() => {
        setChatModel(prev);
      });
    },
    [chatModel]
  );

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  const canSend = inputText.trim().length > 0 && !isStreaming;

  if (!isChatOpen) {
    return <ChatToggleButton isOpen={false} onClick={toggleChat} />;
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <div>
          <h3>アシスタント</h3>
          {availableModels.length > 0 ? (
            <select
              className="chat-model-select"
              value={chatModel}
              onChange={handleModelChange}
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : chatModel ? (
            <span className="chat-model-label">{chatModel}</span>
          ) : null}
        </div>
        <div className="chat-panel-header-actions">
          <button
            className="btn-ghost btn-sm"
            onClick={handleNewConversation}
            title="新しい会話"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className="btn-ghost btn-sm"
            onClick={toggleChat}
            title="閉じる"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !isStreaming && (
          <div className="chat-empty">
            <p>タスクの追加、更新、管理について</p>
            <p>何でも聞いてください</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {toolExecutions.map((te) => (
          <ToolExecutionIndicator key={te.tool_call_id} te={te} />
        ))}

        {streamingContent && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-content">
              {streamingContent}
              <span className="chat-cursor" />
            </div>
          </div>
        )}

        {error && <div className="chat-error">{error}</div>}

        {pendingConfirmation && (
          <ConfirmDialog
            toolCallId={pendingConfirmation.tool_call_id}
            toolName={pendingConfirmation.tool_name}
            args={pendingConfirmation.args}
            description={pendingConfirmation.description}
            onConfirm={handleConfirm}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="メッセージを入力..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button className="chat-send-btn" onClick={handleStop} title="停止">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!canSend}
            title="送信"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
