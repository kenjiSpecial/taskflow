import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import {
  filteredSessions,
  activeSessions,
  loading,
  error,
  filter,
  loadSessions,
  addSession,
} from "../stores/session-store";
import { SessionCard } from "./SessionCard";

export function SessionDashboard() {
  const newTitle = useSignal("");

  useEffect(() => {
    loadSessions();
  }, []);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const title = newTitle.value.trim();
    if (!title) return;
    await addSession({ title });
    newTitle.value = "";
  };

  return (
    <div>
      <div class="header">
        <h1>セッション</h1>
        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          {activeSessions.value.length}件のアクティブ
        </span>
      </div>

      <form class="form-inline" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="新しいセッションを作成..."
          value={newTitle.value}
          onInput={(e) => (newTitle.value = (e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn-primary">作成</button>
      </form>

      <div class="session-filter-bar">
        <select
          value={filter.value.status || ""}
          onChange={(e) =>
            (filter.value = {
              ...filter.value,
              status: (e.target as HTMLSelectElement).value || undefined,
            })
          }
        >
          <option value="">すべて</option>
          <option value="active">進行中</option>
          <option value="paused">一時停止</option>
          <option value="done">完了</option>
        </select>
      </div>

      {error.value && <div class="error">{error.value}</div>}

      {loading.value ? (
        <div class="empty">読み込み中...</div>
      ) : filteredSessions.value.length === 0 ? (
        <div class="empty">
          {filter.value.status
            ? "該当するセッションはありません"
            : "アクティブなセッションはありません"}
        </div>
      ) : (
        <div class="session-grid">
          {filteredSessions.value.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
