import { useRef, useEffect } from "preact/hooks";
import { useSignal, useComputed } from "@preact/signals";
import {
  isChatOpen,
  messages,
  isStreaming,
  streamingContent,
  error,
  toolExecutions,
  pendingConfirmation,
  toggleChat,
  addUserMessage,
  addAssistantMessage,
  startNewConversation,
  addToolExecution,
  updateToolExecution,
} from "../stores/chat-store";
import { bridgeChat, bridgeConfirm, type ViewContext } from "../lib/bridge";
import { loadTodos } from "../stores/todo-store";
import { loadProjects } from "../stores/project-store";
import { loadSessions } from "../stores/session-store";
import { loadTags } from "../stores/tag-store";

function ChatToggleButton() {
  return (
    <button
      class="chat-toggle-btn"
      onClick={toggleChat}
      title="チャットアシスタント"
      aria-label="チャットを開く"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

function ToolExecutionIndicator({ te }: { te: { tool_name: string; status: string } }) {
  const label =
    te.status === "executing"
      ? `${te.tool_name} 実行中...`
      : te.status === "cancelled"
        ? `${te.tool_name} キャンセル`
        : te.status === "error"
          ? `${te.tool_name} エラー`
          : `${te.tool_name} 完了`;

  return (
    <div class={`chat-tool-indicator chat-tool-${te.status}`}>
      {te.status === "executing" && <span class="chat-spinner" />}
      <span>{label}</span>
    </div>
  );
}

function ConfirmDialog() {
  const confirm = pendingConfirmation.value;
  if (!confirm) return null;

  const handleApprove = async () => {
    pendingConfirmation.value = null;
    await bridgeConfirm(confirm.tool_call_id, true);
  };

  const handleReject = async () => {
    pendingConfirmation.value = null;
    await bridgeConfirm(confirm.tool_call_id, false);
  };

  return (
    <div class="chat-confirm-overlay">
      <div class="chat-confirm-dialog">
        <p class="chat-confirm-text">{confirm.description}</p>
        <div class="chat-confirm-details">
          <code>{JSON.stringify(confirm.args, null, 2)}</code>
        </div>
        <div class="chat-confirm-actions">
          <button class="btn-ghost" onClick={handleReject}>
            キャンセル
          </button>
          <button class="btn-danger" onClick={handleApprove}>
            実行
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: { role: string; content: string } }) {
  return (
    <div class={`chat-message chat-message-${msg.role}`}>
      <div class="chat-message-content">{msg.content}</div>
    </div>
  );
}

export function ChatPanel() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputValue = useSignal("");

  const canSend = useComputed(
    () => inputValue.value.trim().length > 0 && !isStreaming.value,
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.value.length, streamingContent.value]);

  // Focus input when panel opens
  useEffect(() => {
    if (isChatOpen.value) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isChatOpen.value]);

  const handleSend = () => {
    const text = inputValue.value.trim();
    if (!text || isStreaming.value) return;

    inputValue.value = "";
    addUserMessage(text);
    isStreaming.value = true;
    streamingContent.value = "";
    error.value = null;
    toolExecutions.value = [];

    const ctrl = bridgeChat(text, {
      onToken(content) {
        streamingContent.value += content;
      },
      onToolCall(data) {
        addToolExecution({
          tool_call_id: data.tool_call_id,
          tool_name: data.tool_name,
          args: data.args,
          status: "executing",
        });
      },
      onToolResult(data) {
        if (data.cancelled) {
          updateToolExecution(data.tool_call_id, { status: "cancelled" });
        } else {
          updateToolExecution(data.tool_call_id, {
            status: "done",
            result: data.result,
          });
          // Refresh stores after tool execution
          void Promise.allSettled([
            loadTodos(),
            loadProjects(),
            loadSessions(),
            loadTags(),
          ]);
        }
      },
      onConfirm(data) {
        pendingConfirmation.value = data;
      },
      onDone() {
        if (streamingContent.value) {
          addAssistantMessage(streamingContent.value);
        }
        streamingContent.value = "";
        isStreaming.value = false;
      },
      onError(data) {
        error.value = data.message;
        if (streamingContent.value) {
          addAssistantMessage(streamingContent.value);
        }
        streamingContent.value = "";
        isStreaming.value = false;
      },
    });

    abortRef.current = ctrl;
  };

  const handleStop = () => {
    abortRef.current?.abort();
    if (streamingContent.value) {
      addAssistantMessage(streamingContent.value);
    }
    streamingContent.value = "";
    isStreaming.value = false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isChatOpen.value) {
    return <ChatToggleButton />;
  }

  return (
    <div class="chat-panel">
      <div class="chat-panel-header">
        <h3>アシスタント</h3>
        <div class="chat-panel-header-actions">
          <button
            class="btn-ghost btn-sm"
            onClick={startNewConversation}
            title="新しい会話"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button class="btn-ghost btn-sm" onClick={toggleChat} title="閉じる">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="chat-messages">
        {messages.value.length === 0 && !isStreaming.value && (
          <div class="chat-empty">
            <p>タスクの追加、更新、管理について</p>
            <p>何でも聞いてください</p>
          </div>
        )}

        {messages.value.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {toolExecutions.value.map((te) => (
          <ToolExecutionIndicator key={te.tool_call_id} te={te} />
        ))}

        {streamingContent.value && (
          <div class="chat-message chat-message-assistant">
            <div class="chat-message-content">
              {streamingContent.value}
              <span class="chat-cursor" />
            </div>
          </div>
        )}

        {error.value && (
          <div class="chat-error">{error.value}</div>
        )}

        <ConfirmDialog />

        <div ref={messagesEndRef} />
      </div>

      <div class="chat-input-area">
        <textarea
          ref={inputRef}
          class="chat-input"
          placeholder="メッセージを入力..."
          value={inputValue.value}
          onInput={(e) => {
            inputValue.value = (e.target as HTMLTextAreaElement).value;
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isStreaming.value}
        />
        {isStreaming.value ? (
          <button class="chat-send-btn" onClick={handleStop} title="停止">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            class="chat-send-btn"
            onClick={handleSend}
            disabled={!canSend.value}
            title="送信"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
