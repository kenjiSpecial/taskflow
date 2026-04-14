"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MessageBubble } from "./MessageBubble";
import { ConfirmDialog } from "./ConfirmDialog";
import { ChatToggleButton } from "./ChatToggleButton";
import {
  bridgeChat,
  bridgeChatConfig,
  bridgeConfirm,
  bridgeSetModel,
  type ViewContext,
} from "@/lib/bridge";
import { useChatPersistence } from "@/lib/hooks/useChat";
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
    <div className="flex items-center gap-2 text-xs text-gray-400 px-3 py-1">
      {te.status === "executing" && (
        <span className="inline-block w-3 h-3 border-2 border-gray-500 border-t-gray-200 rounded-full animate-spin" />
      )}
      <span>{label}</span>
    </div>
  );
}

// --- Main Component ---

function buildViewContext(pathname: string): ViewContext {
  if (pathname.startsWith("/tasks/")) {
    return { currentPage: `task-detail:${pathname.split("/")[2]}` };
  }
  if (pathname.startsWith("/projects/")) {
    return { currentPage: "project-detail", activeProjectId: pathname.split("/")[2] };
  }
  if (pathname.startsWith("/sessions/")) {
    return { currentPage: "session-detail" };
  }
  return { currentPage: "kanban" };
}

export function ChatPanel() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const {
    restoredMessages,
    restoredToolExecutions,
    isRestoring,
    saveMessage,
    newConversation,
  } = useChatPersistence();

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [chatModel, setChatModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [inputText, setInputText] = useState("");

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef("");
  const lastGreetedPathRef = useRef<string | null>(null);

  // Listen for task reference insert events from kanban cards
  useEffect(() => {
    function handleInsertRef(e: Event) {
      const { type, id, title } = (e as CustomEvent).detail as { type: string; id: string; title: string };
      const ref = type === "task" ? `[タスク: ${title} (ID: ${id})] ` : `[${title} (ID: ${id})] `;
      setInputText((prev) => prev + ref);
      setIsChatOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    window.addEventListener("taskflow:insert-ref", handleInsertRef);
    return () => window.removeEventListener("taskflow:insert-ref", handleInsertRef);
  }, []);

  // Load chat config on mount
  useEffect(() => {
    void bridgeChatConfig()
      .then((c) => {
        setChatModel(c.model);
        setAvailableModels(c.availableModels);
      })
      .catch(() => {});
  }, []);

  // Restore messages from DB
  useEffect(() => {
    if (!isRestoring && restoredMessages.length > 0) {
      setMessages(restoredMessages);
      setToolExecutions(restoredToolExecutions);
    }
  }, [isRestoring, restoredMessages, restoredToolExecutions]);

  // Auto-greet on page change (empty conversation only)
  useEffect(() => {
    if (isRestoring || isStreaming) return;
    if (messages.length > 0) return;
    if (lastGreetedPathRef.current === pathname) return;
    if (!isChatOpen) return;

    lastGreetedPathRef.current = pathname;
    const viewContext = buildViewContext(pathname);

    setIsStreaming(true);
    setStreamingContent("");
    streamingContentRef.current = "";

    const ctrl = bridgeChat("", {
      onToken(content) {
        streamingContentRef.current += content;
        setStreamingContent(streamingContentRef.current);
      },
      onToolCall() {},
      onToolResult() {},
      onConfirm() {},
      onDone(data) {
        if (data.model) setChatModel(data.model);
        const finalContent = streamingContentRef.current;
        if (finalContent) {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: finalContent },
          ]);
        }
        setStreamingContent("");
        streamingContentRef.current = "";
        setIsStreaming(false);
      },
      onError() {
        setStreamingContent("");
        streamingContentRef.current = "";
        setIsStreaming(false);
      },
    }, { context: viewContext });

    abortRef.current = ctrl;
  }, [pathname, isRestoring, isStreaming, messages.length, isChatOpen]);

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

    // Save user message to DB
    saveMessage({ role: "user", content: text });

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
        // Save tool call to DB
        saveMessage({
          role: "assistant",
          tool_calls: JSON.stringify([{ tool_name: data.tool_name, args: data.args }]),
          tool_call_id: data.tool_call_id,
        });
      },
      onToolResult(data) {
        if (data.cancelled) {
          setToolExecutions((prev) =>
            prev.map((te) =>
              te.tool_call_id === data.tool_call_id
                ? { ...te, status: "cancelled" as const }
                : te,
            ),
          );
        } else {
          setToolExecutions((prev) =>
            prev.map((te) =>
              te.tool_call_id === data.tool_call_id
                ? { ...te, status: "done" as const, result: data.result }
                : te,
            ),
          );
          invalidateAll();
          // Save tool result to DB
          saveMessage({
            role: "tool",
            tool_call_id: data.tool_call_id,
            tool_name: data.tool_name,
            content: JSON.stringify(data.result),
          });
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
          // Save assistant message to DB
          saveMessage({ role: "assistant", content: finalContent });
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
          // Save partial assistant message to DB
          saveMessage({ role: "assistant", content: finalContent });
        }
        setStreamingContent("");
        streamingContentRef.current = "";
        setIsStreaming(false);
      },
    }, {
      context: buildViewContext(pathname),
      history: messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content, timestamp: Date.now() })),
    });

    abortRef.current = ctrl;
  }, [inputText, isStreaming, invalidateAll, pathname, messages]);

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
    [handleSend],
  );

  const handleConfirm = useCallback(
    async (approved: boolean) => {
      if (!pendingConfirmation) return;
      const toolCallId = pendingConfirmation.tool_call_id;
      setPendingConfirmation(null);
      await bridgeConfirm(toolCallId, approved);
    },
    [pendingConfirmation],
  );

  const handleNewConversation = useCallback(() => {
    newConversation();
    lastGreetedPathRef.current = null;
    setMessages([]);
    setStreamingContent("");
    streamingContentRef.current = "";
    setError(null);
    setToolExecutions([]);
    setPendingConfirmation(null);
  }, [newConversation]);

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newModel = e.target.value;
      const prev = chatModel;
      setChatModel(newModel);
      void bridgeSetModel(newModel).catch(() => {
        setChatModel(prev);
      });
    },
    [chatModel],
  );

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  const canSend = inputText.trim().length > 0 && !isStreaming;

  if (!isChatOpen) {
    return <ChatToggleButton isOpen={false} onClick={toggleChat} />;
  }

  return (
    <div className="w-96 h-full border-l border-gray-800 bg-gray-950 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">アシスタント</h3>
          {availableModels.length > 0 ? (
            <select
              className="text-xs bg-gray-800 text-gray-400 border border-gray-700 rounded px-1 py-0.5 mt-1"
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
            <span className="text-xs text-gray-500">{chatModel}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 text-gray-400 hover:text-white rounded transition-colors"
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
            className="p-1 text-gray-400 hover:text-white rounded transition-colors"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
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
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm max-w-[80%]">
              {streamingContent}
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm px-3 py-2 bg-red-900/20 rounded">
            {error}
          </div>
        )}

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

      {/* Input */}
      <div className="flex items-end gap-2 p-3 border-t border-gray-800">
        <textarea
          ref={inputRef}
          className="flex-1 bg-gray-800 text-gray-100 text-sm rounded-md px-3 py-2 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
          placeholder="メッセージを入力..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            className="p-2 text-gray-400 hover:text-white transition-colors"
            onClick={handleStop}
            title="停止"
          >
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
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
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
