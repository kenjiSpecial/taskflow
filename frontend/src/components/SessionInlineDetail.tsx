import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { expandedSessionId } from "../stores/app-store";
import { MarkdownContent } from "./MarkdownContent";
import {
  sessions,
  sessionLogs,
  linkedTasks,
  loadSessionLogs,
  addSessionLog,
  editSession,
  removeSession,
  loadSessions,
  loadLinkedTasks,
  linkTask,
  unlinkTask,
} from "../stores/session-store";
import { todos, toggleTodo } from "../stores/todo-store";
import type { Todo } from "../lib/api";

const statusLabel: Record<string, string> = {
  active: "進行中",
  paused: "一時停止",
  done: "完了",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskSearch({ sessionId }: { sessionId: string }) {
  const query = useSignal("");
  const showResults = useSignal(false);

  const linkedIds = new Set(linkedTasks.value.map((t) => t.id));
  const q = query.value.toLowerCase();
  const results = q.length > 0
    ? todos.value.filter(
        (t) => t.title.toLowerCase().includes(q) && !linkedIds.has(t.id) && t.status !== "completed",
      ).slice(0, 20)
    : [];

  const handleSelect = async (todoId: string) => {
    await linkTask(sessionId, todoId);
    query.value = "";
    showResults.value = false;
  };

  return (
    <div class="task-search">
      <input
        type="text"
        placeholder="タスクを検索して紐付け..."
        value={query.value}
        onInput={(e) => {
          query.value = (e.target as HTMLInputElement).value;
          showResults.value = true;
        }}
        onBlur={() => setTimeout(() => (showResults.value = false), 200)}
        onFocus={() => {
          if (results.length > 0) showResults.value = true;
        }}
      />
      {showResults.value && results.length > 0 && (
        <div class="task-search-results">
          {results.map((todo) => (
            <div
              key={todo.id}
              class="task-search-item"
              onMouseDown={() => handleSelect(todo.id)}
            >
              <span>{todo.title}</span>
              <span class={`badge badge-${todo.priority}`}>{todo.priority}</span>
            </div>
          ))}
        </div>
      )}
      {showResults.value && query.value.length > 0 && results.length === 0 && (
        <div class="task-search-results">
          <div class="task-search-empty">該当するタスクがありません</div>
        </div>
      )}
    </div>
  );
}

export function SessionInlineDetail() {
  const newLog = useSignal("");
  const sessionId = expandedSessionId.value;

  useEffect(() => {
    if (sessionId) {
      loadSessionLogs(sessionId);
      loadLinkedTasks(sessionId);
    }
  }, [sessionId]);

  if (!sessionId) return null;

  const session = sessions.value.find((s) => s.id === sessionId);
  if (!session) return null;

  const handleAddLog = async (e: Event) => {
    e.preventDefault();
    const content = newLog.value.trim();
    if (!content) return;
    await addSessionLog(sessionId, content);
    newLog.value = "";
  };

  const handleStatusChange = async (status: "active" | "paused" | "done") => {
    await editSession(sessionId, { status });
  };

  const handleDelete = async () => {
    if (!window.confirm(`セッション「${session.title}」を削除しますか？`)) return;
    await removeSession(sessionId);
    expandedSessionId.value = null;
    loadSessions();
  };

  const handleToggleTodo = async (todo: Todo) => {
    await toggleTodo(todo.id, todo.status);
    await loadLinkedTasks(sessionId);
  };

  const isDone = session.status === "done";

  return (
    <div class="inline-detail">
      <div class="inline-detail-header">
        <div class="inline-detail-title-row">
          <h3>{session.title}</h3>
          <span class={`session-status-badge status-${session.status}`}>
            {statusLabel[session.status]}
          </span>
          <span class="inline-detail-date">
            {formatDate(session.created_at)}
          </span>
          <button
            class="btn-ghost"
            onClick={() => (expandedSessionId.value = null)}
          >
            ✕
          </button>
        </div>

        <div class="inline-detail-actions">
          {session.status !== "active" && (
            <button class="btn-ghost" onClick={() => handleStatusChange("active")}>
              再開
            </button>
          )}
          {session.status === "active" && (
            <button class="btn-ghost" onClick={() => handleStatusChange("paused")}>
              一時停止
            </button>
          )}
          {session.status !== "done" && (
            <button class="btn-ghost" onClick={() => handleStatusChange("done")}>
              完了
            </button>
          )}
          <button class="btn-danger" onClick={handleDelete}>
            削除
          </button>
        </div>
      </div>

      <div class="inline-detail-body">
        {/* 関連タスク */}
        <div class="inline-detail-section">
          <h4>関連タスク</h4>
          {!isDone && <TaskSearch sessionId={sessionId} />}
          {linkedTasks.value.length === 0 ? (
            <div class="empty" style={{ padding: "0.75rem", fontSize: "0.8125rem" }}>
              紐付けタスクなし
            </div>
          ) : (
            <div class="linked-task-list">
              {linkedTasks.value.map((todo) => (
                <div key={todo.id} class={`linked-task-item ${todo.status === "completed" ? "completed" : ""}`}>
                  <input
                    type="checkbox"
                    class="todo-checkbox"
                    checked={todo.status === "completed"}
                    onChange={() => handleToggleTodo(todo)}
                  />
                  <span class="linked-task-title" style={{ flex: 1 }}>{todo.title}</span>
                  <button
                    class="btn-ghost"
                    style={{ fontSize: "0.75rem" }}
                    onClick={() => unlinkTask(sessionId, todo.id)}
                  >
                    解除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ログ */}
        <div class="inline-detail-section">
          <h4>ログ</h4>
          {sessionLogs.value.length > 0 && (
            <div class="session-log-list">
              {sessionLogs.value.map((log) => (
                <div key={log.id} class="session-log-item">
                  <div class="session-log-time">{formatDate(log.created_at)}</div>
                  <MarkdownContent content={log.content} class="session-log-content-md" />
                </div>
              ))}
            </div>
          )}
          {!isDone && (
            <form class="session-log-form" onSubmit={handleAddLog}>
              <textarea
                placeholder="作業メモを追加..."
                value={newLog.value}
                onInput={(e) => (newLog.value = (e.target as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAddLog(e);
                  }
                }}
                rows={2}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                  Cmd+Enter で送信
                </span>
                <button type="submit" class="btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8125rem" }}>
                  追加
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
