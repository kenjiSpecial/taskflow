import { useSignal } from "@preact/signals";
import type { WorkSession } from "../lib/api";
import { expandedSessionId, doneExpandedProjects, toggleDoneExpanded } from "../stores/app-store";
import { addSession } from "../stores/session-store";

interface Props {
  sessions: WorkSession[];
  status: "active" | "paused" | "done";
  projectId: string | null;
  isArchived: boolean;
}

const DONE_LIMIT = 3;

export function SessionCell({ sessions, status, projectId, isArchived }: Props) {
  const adding = useSignal(false);
  const title = useSignal("");

  const isDone = status === "done";
  const doneExpanded = isDone && projectId !== null && doneExpandedProjects.value.has(projectId);
  const visibleSessions = isDone && !doneExpanded ? sessions.slice(0, DONE_LIMIT) : sessions;
  const hiddenCount = isDone ? sessions.length - DONE_LIMIT : 0;

  const handleAdd = async () => {
    const value = title.value.trim();
    if (!value) return;
    await addSession({
      title: value,
      project_id: projectId,
      status,
    });
    title.value = "";
    adding.value = false;
  };

  const handleCardClick = (sessionId: string) => {
    expandedSessionId.value = expandedSessionId.value === sessionId ? null : sessionId;
  };

  return (
    <div class="matrix-cell matrix-session-cell">
      {visibleSessions.map((s) => (
        <div
          key={s.id}
          class={`matrix-session-card ${expandedSessionId.value === s.id ? "expanded" : ""}`}
          onClick={() => handleCardClick(s.id)}
        >
          <div class="matrix-session-title">{s.title}</div>
          {s.task_total > 0 && (
            <div class="matrix-session-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style={{ width: `${(s.task_completed / s.task_total) * 100}%` }}
                />
              </div>
              <span class="progress-text">{s.task_completed}/{s.task_total}</span>
            </div>
          )}
        </div>
      ))}

      {isDone && hiddenCount > 0 && !doneExpanded && (
        <button
          class="btn-ghost matrix-show-more"
          onClick={() => projectId && toggleDoneExpanded(projectId)}
        >
          あと {hiddenCount} 件
        </button>
      )}
      {isDone && doneExpanded && hiddenCount > 0 && (
        <button
          class="btn-ghost matrix-show-more"
          onClick={() => projectId && toggleDoneExpanded(projectId)}
        >
          折りたたむ
        </button>
      )}

      {!isArchived && !isDone && (
        <>
          {adding.value ? (
            <div class="matrix-add-form">
              <input
                type="text"
                placeholder="セッション名..."
                value={title.value}
                onInput={(e) => (title.value = (e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") (adding.value = false);
                }}
                // biome-ignore lint: autofocus is intentional
                autoFocus
              />
            </div>
          ) : (
            <button
              class="btn-ghost matrix-add-btn"
              onClick={() => (adding.value = true)}
            >
              +
            </button>
          )}
        </>
      )}
    </div>
  );
}
