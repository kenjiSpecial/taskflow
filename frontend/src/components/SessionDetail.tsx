import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { selectedSessionId } from "../stores/app-store";
import {
  sessions,
  sessionLogs,
  loadSessionLogs,
  addSessionLog,
  editSession,
  removeSession,
  loadSessions,
} from "../stores/session-store";

const statusLabel: Record<string, string> = {
  active: "進行中",
  paused: "一時停止",
  done: "完了",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionDetail() {
  const newLog = useSignal("");
  const sessionId = selectedSessionId.value;

  useEffect(() => {
    if (sessionId) {
      loadSessionLogs(sessionId);
    }
  }, [sessionId]);

  if (!sessionId) return null;

  const session = sessions.value.find((s) => s.id === sessionId);
  if (!session) return <div class="empty">セッションが見つかりません</div>;

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
    await removeSession(sessionId);
    selectedSessionId.value = null;
    loadSessions();
  };

  const isDone = session.status === "done";

  return (
    <div>
      <button
        class="btn-ghost"
        style={{ marginBottom: "1rem" }}
        onClick={() => (selectedSessionId.value = null)}
      >
        ← 戻る
      </button>

      <div class="session-detail-header">
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{session.title}</h1>
        <div class="session-detail-meta">
          <span class={`session-status-badge status-${session.status}`}>
            {statusLabel[session.status]}
          </span>
          {session.project && <span class="session-project">{session.project}</span>}
          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            作成: {formatDate(session.created_at)}
          </span>
        </div>
      </div>

      {session.description && (
        <p style={{ color: "var(--text-muted)", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {session.description}
        </p>
      )}

      <div class="session-actions">
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

      <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "1.5rem 0 1rem" }}>ログ</h2>

      {sessionLogs.value.length === 0 ? (
        <div class="empty" style={{ padding: "1.5rem" }}>ログはまだありません</div>
      ) : (
        <div class="session-log-list">
          {sessionLogs.value.map((log) => (
            <div key={log.id} class="session-log-item">
              <div class="session-log-time">{formatDate(log.created_at)}</div>
              <div class="session-log-content">{log.content}</div>
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
            rows={3}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Cmd+Enter で送信
            </span>
            <button type="submit" class="btn-primary">追加</button>
          </div>
        </form>
      )}
    </div>
  );
}
