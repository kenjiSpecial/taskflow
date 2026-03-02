import { useSignal } from "@preact/signals";
import type { WorkSession } from "../../lib/api";
import { editSession } from "../../stores/session-store";
import { detailExpandedSessionId } from "../../stores/app-store";
import { SessionDetailPanel } from "./SessionDetailPanel";

interface Props {
  sessions: WorkSession[];
  projectId: string;
}

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function ActiveSessionsSection({ sessions, projectId }: Props) {
  const adding = useSignal(false);
  const newTitle = useSignal("");
  const active = sessions.filter((s) => s.status === "active");

  const handlePause = async (id: string, e: Event) => {
    e.stopPropagation();
    await editSession(id, { status: "paused" });
  };

  const handleDone = async (id: string, e: Event) => {
    e.stopPropagation();
    await editSession(id, { status: "done" });
  };

  return (
    <section class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-app-text-muted uppercase tracking-wide flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-app-success" />
          アクティブセッション
          <span class="text-xs font-normal">({active.length})</span>
        </h2>
        <NewSessionButton projectId={projectId} allSessions={sessions} />
      </div>
      {active.length === 0 && (
        <p class="text-sm text-app-text-muted py-2 text-center">アクティブなセッションはありません</p>
      )}
      <div class="flex flex-col gap-2">
        {active.map((session) => (
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
                  <span class="text-xs text-app-success font-medium">{formatElapsed(session.updated_at)}</span>
                  <button
                    class="text-xs px-2 py-0.5 rounded bg-app-surface-hover text-app-warning hover:text-app-text"
                    onClick={(e) => handlePause(session.id, e)}
                  >
                    一時停止
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
                      class="h-full bg-app-success rounded-full"
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

// 新規セッション作成ボタン（activeセッション制約付き）
import { addSession, sessions as allSessionsSignal } from "../../stores/session-store";

function NewSessionButton({ projectId, allSessions }: { projectId: string; allSessions: WorkSession[] }) {
  const adding = useSignal(false);
  const title = useSignal("");

  const handleCreate = async () => {
    const t = title.value.trim();
    if (!t) return;

    // activeセッション制約チェック（全プロジェクト横断）
    const existingActive = allSessionsSignal.value.find((s) => s.status === "active");
    if (existingActive) {
      const ok = window.confirm(
        `「${existingActive.title}」がアクティブです。\n一時停止して新しいセッションを開始しますか？`,
      );
      if (!ok) return;
      await editSession(existingActive.id, { status: "paused" });
    }

    await addSession({ title: t, project_id: projectId, status: "active" });
    title.value = "";
    adding.value = false;
  };

  if (!adding.value) {
    return (
      <button
        class="text-xs text-app-accent hover:text-app-accent-hover"
        onClick={() => (adding.value = true)}
      >
        + セッション
      </button>
    );
  }

  return (
    <div class="flex gap-2">
      <input
        type="text"
        class="text-sm bg-app-surface border border-app-border rounded px-2 py-0.5 outline-none focus:border-app-accent"
        placeholder="セッション名..."
        value={title.value}
        onInput={(e) => (title.value = (e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") (adding.value = false);
        }}
        // biome-ignore lint: autofocus is intentional
        autoFocus
      />
      <button class="text-xs bg-app-accent text-white rounded px-2 py-0.5 hover:bg-app-accent-hover" onClick={handleCreate}>
        開始
      </button>
    </div>
  );
}
