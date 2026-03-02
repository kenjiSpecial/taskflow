import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import {
  sessions,
  sessionLogs,
  linkedTasks,
  loadSessionLogs,
  addSessionLog,
  loadLinkedTasks,
  linkTask,
  unlinkTask,
  removeSession,
} from "../../stores/session-store";
import { todos, toggleTodo } from "../../stores/todo-store";
import { detailExpandedSessionId } from "../../stores/app-store";
import type { Todo } from "../../lib/api";

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

interface Props {
  sessionId: string;
}

export function SessionDetailPanel({ sessionId }: Props) {
  const newLog = useSignal("");
  const searchQuery = useSignal("");
  const showResults = useSignal(false);

  useEffect(() => {
    loadSessionLogs(sessionId);
    loadLinkedTasks(sessionId);
  }, [sessionId]);

  const session = sessions.value.find((s) => s.id === sessionId);
  if (!session) return null;

  const isDone = session.status === "done";

  const handleAddLog = async (e: Event) => {
    e.preventDefault();
    const content = newLog.value.trim();
    if (!content) return;
    await addSessionLog(sessionId, content);
    newLog.value = "";
  };

  const handleToggleTodo = async (todo: Todo) => {
    await toggleTodo(todo.id, todo.status);
    await loadLinkedTasks(sessionId);
  };

  const handleDelete = async () => {
    if (!window.confirm(`セッション「${session.title}」を削除しますか？`)) return;
    await removeSession(sessionId);
    detailExpandedSessionId.value = null;
  };

  // タスク検索
  const linkedIds = new Set(linkedTasks.value.map((t) => t.id));
  const q = searchQuery.value.toLowerCase();
  const searchResults = q.length > 0
    ? todos.value.filter(
        (t) => t.title.toLowerCase().includes(q) && !linkedIds.has(t.id) && t.status !== "completed",
      ).slice(0, 10)
    : [];

  const handleLinkTask = async (todoId: string) => {
    await linkTask(sessionId, todoId);
    searchQuery.value = "";
    showResults.value = false;
  };

  return (
    <div class="mt-1 rounded-lg bg-app-surface border border-t-2 border-app-accent p-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 関連タスク */}
        <div>
          <h4 class="text-xs font-semibold text-app-text-muted uppercase mb-2">関連タスク</h4>
          {!isDone && (
            <div class="relative mb-2">
              <input
                type="text"
                class="w-full text-sm bg-app-bg border border-app-border rounded px-2 py-1.5 outline-none focus:border-app-accent"
                placeholder="タスクを検索して紐付け..."
                value={searchQuery.value}
                onInput={(e) => {
                  searchQuery.value = (e.target as HTMLInputElement).value;
                  showResults.value = true;
                }}
                onBlur={() => setTimeout(() => (showResults.value = false), 200)}
                onFocus={() => { if (searchResults.length > 0) showResults.value = true; }}
              />
              {showResults.value && searchQuery.value.length > 0 && (
                <div class="absolute top-full left-0 right-0 z-10 bg-app-surface border border-app-border rounded-md max-h-48 overflow-y-auto mt-0.5">
                  {searchResults.length > 0 ? (
                    searchResults.map((todo) => (
                      <div
                        key={todo.id}
                        class="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-app-surface-hover cursor-pointer"
                        onMouseDown={() => handleLinkTask(todo.id)}
                      >
                        <span class="truncate">{todo.title}</span>
                        <span class={`text-xs badge badge-${todo.priority}`}>{todo.priority}</span>
                      </div>
                    ))
                  ) : (
                    <div class="px-3 py-2 text-sm text-app-text-muted text-center">該当なし</div>
                  )}
                </div>
              )}
            </div>
          )}
          {linkedTasks.value.length === 0 ? (
            <p class="text-sm text-app-text-muted py-2 text-center">紐付けタスクなし</p>
          ) : (
            <div class="flex flex-col gap-1">
              {linkedTasks.value.map((todo) => (
                <div key={todo.id} class="flex items-center gap-2 px-2 py-1 rounded hover:bg-app-surface-hover">
                  <input
                    type="checkbox"
                    class="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer flex-shrink-0"
                    checked={todo.status === "completed"}
                    onChange={() => handleToggleTodo(todo)}
                  />
                  <span class={`text-sm flex-1 truncate ${todo.status === "completed" ? "line-through text-app-text-muted" : ""}`}>
                    {todo.title}
                  </span>
                  <button
                    class="text-xs text-app-text-muted hover:text-app-danger"
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
        <div>
          <h4 class="text-xs font-semibold text-app-text-muted uppercase mb-2">ログ</h4>
          {sessionLogs.value.length > 0 && (
            <div class="flex flex-col gap-2 mb-3 max-h-64 overflow-y-auto">
              {sessionLogs.value.map((log) => (
                <div key={log.id} class="rounded bg-app-bg border-l-2 border-app-accent px-3 py-2">
                  <div class="text-[0.625rem] text-app-text-muted mb-0.5">{formatDate(log.created_at)}</div>
                  <div class="text-sm whitespace-pre-wrap">{log.content}</div>
                </div>
              ))}
            </div>
          )}
          {!isDone && (
            <form onSubmit={handleAddLog} class="flex flex-col gap-1.5">
              <textarea
                class="w-full text-sm bg-app-bg border border-app-border rounded px-2 py-1.5 outline-none focus:border-app-accent resize-y min-h-[60px]"
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
              <div class="flex items-center justify-between">
                <span class="text-[0.625rem] text-app-text-muted">Cmd+Enter で送信</span>
                <button type="submit" class="text-xs bg-app-accent text-white rounded px-3 py-1 hover:bg-app-accent-hover">追加</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div class="mt-3 pt-3 border-t border-app-border flex justify-end">
        <button
          class="text-xs text-app-danger hover:underline"
          onClick={handleDelete}
        >
          セッションを削除
        </button>
      </div>
    </div>
  );
}
