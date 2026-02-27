import type { WorkSession } from "../lib/api";
import { selectedSessionId } from "../stores/app-store";

interface Props {
  session: WorkSession;
}

const statusLabel: Record<string, string> = {
  active: "進行中",
  paused: "一時停止",
  done: "完了",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SessionCard({ session }: Props) {
  const latestLog = session.recent_logs?.[0];

  return (
    <div
      class="session-card"
      onClick={() => (selectedSessionId.value = session.id)}
    >
      <div class="session-card-header">
        <span class={`session-status-badge status-${session.status}`}>
          {statusLabel[session.status]}
        </span>
        {session.project && <span class="session-project">{session.project}</span>}
      </div>
      <div class="session-card-title">{session.title}</div>
      {latestLog && (
        <div class="session-card-preview">
          {latestLog.content.slice(0, 100)}
          {latestLog.content.length > 100 ? "..." : ""}
        </div>
      )}
      <div class="session-card-footer">
        <span class="session-card-date">{formatDate(session.updated_at)}</span>
      </div>
    </div>
  );
}
