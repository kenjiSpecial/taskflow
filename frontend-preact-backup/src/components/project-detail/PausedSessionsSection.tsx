import type { WorkSession } from "../../lib/api";
import { editSession } from "../../stores/session-store";
import { sessions as allSessionsSignal } from "../../stores/session-store";
import { detailExpandedSessionId } from "../../stores/app-store";
import { SessionDetailPanel } from "./SessionDetailPanel";

interface Props {
  sessions: WorkSession[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PausedSessionsSection({ sessions }: Props) {
  const paused = sessions.filter((s) => s.status === "paused");

  if (paused.length === 0) return null;

  const handleResume = async (id: string, e: Event) => {
    e.stopPropagation();
    // activeセッション制約チェック
    const existingActive = allSessionsSignal.value.find((s) => s.status === "active");
    if (existingActive) {
      const ok = window.confirm(
        `「${existingActive.title}」がアクティブです。\n一時停止して再開しますか？`,
      );
      if (!ok) return;
      await editSession(existingActive.id, { status: "paused" });
    }
    await editSession(id, { status: "active" });
  };

  const handleDone = async (id: string, e: Event) => {
    e.stopPropagation();
    await editSession(id, { status: "done" });
    if (detailExpandedSessionId.value === id) {
      detailExpandedSessionId.value = null;
    }
  };

  return (
    <section class="mb-6">
      <h2 class="text-sm font-semibold text-app-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-app-warning" />
        一時停止中
        <span class="text-xs font-normal">({paused.length})</span>
      </h2>
      <div class="flex flex-col gap-2">
        {paused.map((session) => (
          <div key={session.id}>
            <div
              class={`rounded-lg bg-app-surface border p-3 hover:border-app-accent transition-colors cursor-pointer ${
                detailExpandedSessionId.value === session.id ? "border-app-accent" : "border-app-border"
              }`}
              onClick={() => {
                detailExpandedSessionId.value =
                  detailExpandedSessionId.value === session.id ? null : session.id;
              }}
            >
              <div class="flex items-center justify-between mb-1">
                <span class="font-medium text-sm">{session.title}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-app-text-muted">{formatDate(session.updated_at)}</span>
                  <button
                    class="text-xs px-2 py-0.5 rounded bg-app-surface-hover text-app-success hover:text-app-text"
                    onClick={(e) => handleResume(session.id, e)}
                  >
                    再開
                  </button>
                  <button
                    class="text-xs px-2 py-0.5 rounded bg-app-surface-hover text-app-text-muted hover:text-app-text"
                    onClick={(e) => handleDone(session.id, e)}
                  >
                    完了
                  </button>
                </div>
              </div>
              {session.task_total > 0 && (
                <div class="flex items-center gap-2 mt-1">
                  <div class="flex-1 h-1 bg-app-border rounded-full overflow-hidden">
                    <div
                      class="h-full bg-app-warning rounded-full"
                      style={{ width: `${(session.task_completed / session.task_total) * 100}%` }}
                    />
                  </div>
                  <span class="text-xs text-app-text-muted">{session.task_completed}/{session.task_total}</span>
                </div>
              )}
            </div>
            {detailExpandedSessionId.value === session.id && (
              <SessionDetailPanel sessionId={session.id} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
