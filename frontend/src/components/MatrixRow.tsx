import { useComputed, useSignal } from "@preact/signals";
import { sessions, addSession } from "../stores/session-store";
import { todos } from "../stores/todo-store";
import { expandedSessionId, badgeExpandedProjects, toggleBadgeExpanded } from "../stores/app-store";
import { ProjectCell } from "./ProjectCell";
import { SessionCell } from "./SessionCell";
import { TasksCell } from "./TasksCell";
import { SessionInlineDetail } from "./SessionInlineDetail";
import type { Tag, WorkSession } from "../lib/api";
import type { MatrixViewMode } from "./MatrixView";

interface Props {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  projectDescription: string | null;
  projectTags: Tag[];
  isArchived: boolean;
  viewMode: MatrixViewMode;
}

function ActiveSessionCard({ session }: { session: WorkSession }) {
  const isExpanded = expandedSessionId.value === session.id;

  return (
    <div
      class={`active-session-card ${isExpanded ? "expanded" : ""}`}
      onClick={() => {
        expandedSessionId.value = isExpanded ? null : session.id;
      }}
    >
      <div class="active-session-title">{session.title}</div>
      {session.task_total > 0 && (
        <div class="active-session-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style={{ width: `${(session.task_completed / session.task_total) * 100}%` }}
            />
          </div>
          <span class="progress-text">
            {session.task_completed}/{session.task_total}
          </span>
        </div>
      )}
    </div>
  );
}

function BadgeSessionCard({ session }: { session: WorkSession }) {
  const isExpanded = expandedSessionId.value === session.id;

  return (
    <div
      class={`matrix-session-card ${isExpanded ? "expanded" : ""}`}
      onClick={() => {
        expandedSessionId.value = isExpanded ? null : session.id;
      }}
    >
      <div class="matrix-session-title">{session.title}</div>
      {session.task_total > 0 && (
        <div class="matrix-session-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style={{ width: `${(session.task_completed / session.task_total) * 100}%` }}
            />
          </div>
          <span class="progress-text">{session.task_completed}/{session.task_total}</span>
        </div>
      )}
    </div>
  );
}

export function MatrixRow({ projectId, projectName, projectColor, projectDescription, projectTags, isArchived, viewMode }: Props) {
  const addingSession = useSignal(false);
  const newSessionTitle = useSignal("");

  const projectSessions = useComputed(() =>
    sessions.value.filter((s) =>
      projectId === null ? !s.project_id : s.project_id === projectId,
    ),
  );

  const activeSessions = useComputed(() =>
    projectSessions.value.filter((s) => s.status === "active"),
  );
  const pausedSessions = useComputed(() =>
    projectSessions.value.filter((s) => s.status === "paused"),
  );
  const doneSessions = useComputed(() =>
    projectSessions.value
      .filter((s) => s.status === "done")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  );

  const projectTodos = useComputed(() =>
    todos.value.filter((t) =>
      projectId === null ? !t.project_id : t.project_id === projectId,
    ),
  );

  const expandedInThisCard = useComputed(() => {
    const eid = expandedSessionId.value;
    if (!eid) return false;
    return projectSessions.value.some((s) => s.id === eid);
  });

  // --- Matrix (grid) mode ---
  if (viewMode === "matrix") {
    const colorStyle = projectColor
      ? { borderLeft: `3px solid ${projectColor}` }
      : {};

    const key = projectId ?? "_uncategorized";
    const badgeState = badgeExpandedProjects.value.get(key);
    const pausedExpanded = badgeState?.has("paused") ?? false;
    const doneExpanded = badgeState?.has("done") ?? false;
    const hasBadgeExpanded = pausedExpanded || doneExpanded;

    return (
      <>
        <div class={`matrix-cell matrix-project-cell ${isArchived ? "archived" : ""}`} style={colorStyle}>
          <ProjectCell
            projectId={projectId}
            projectName={projectName}
            projectDescription={projectDescription}
            projectTags={projectTags}
            isArchived={isArchived}
          />
          <div class="card-badges">
            {pausedSessions.value.length > 0 && (
              <button
                class={`card-badge badge-paused ${pausedExpanded ? "badge-active" : ""}`}
                onClick={() => toggleBadgeExpanded(key, "paused")}
                title="一時停止中のセッション"
              >
                ⏸ {pausedSessions.value.length}
              </button>
            )}
            {doneSessions.value.length > 0 && (
              <button
                class={`card-badge badge-done ${doneExpanded ? "badge-active" : ""}`}
                onClick={() => toggleBadgeExpanded(key, "done")}
                title="完了したセッション"
              >
                ✓ {doneSessions.value.length}
              </button>
            )}
          </div>
        </div>
        <SessionCell sessions={activeSessions.value} status="active" projectId={projectId} isArchived={isArchived} />
        <div class="matrix-cell matrix-tasks-cell">
          <TasksCell projectId={projectId} todos={projectTodos.value} isArchived={isArchived} viewMode="matrix" />
        </div>
        {hasBadgeExpanded && (
          <div class="matrix-badge-row">
            <div class="matrix-badge-sections">
              {pausedExpanded && pausedSessions.value.length > 0 && (
                <div>
                  <div class="badge-expanded-label">一時停止中</div>
                  <div class="badge-expanded-list">
                    {pausedSessions.value.map((s) => (
                      <BadgeSessionCard key={s.id} session={s} />
                    ))}
                  </div>
                </div>
              )}
              {doneExpanded && doneSessions.value.length > 0 && (
                <div>
                  <div class="badge-expanded-label">完了</div>
                  <div class="badge-expanded-list">
                    {doneSessions.value.slice(0, 5).map((s) => (
                      <BadgeSessionCard key={s.id} session={s} />
                    ))}
                    {doneSessions.value.length > 5 && (
                      <div class="badge-expanded-more">他 {doneSessions.value.length - 5} 件</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {expandedInThisCard.value && (
          <div class="matrix-detail-row">
            <SessionInlineDetail />
          </div>
        )}
      </>
    );
  }

  // --- Card mode ---
  const hasActive = activeSessions.value.length > 0;
  const key = projectId ?? "_uncategorized";
  const badgeState = badgeExpandedProjects.value.get(key);
  const pausedExpanded = badgeState?.has("paused") ?? false;
  const doneExpanded = badgeState?.has("done") ?? false;

  const handleAddSession = async () => {
    const value = newSessionTitle.value.trim();
    if (!value) return;
    await addSession({
      title: value,
      project_id: projectId,
      status: "active",
    });
    newSessionTitle.value = "";
    addingSession.value = false;
  };

  const colorStyle = projectColor
    ? { borderLeft: `3px solid ${projectColor}` }
    : {};

  return (
    <div
      class={`project-card ${hasActive ? "project-card-large" : "project-card-compact"} ${isArchived ? "archived" : ""}`}
      style={colorStyle}
    >
      {/* Card Header */}
      <div class="project-card-header">
        <ProjectCell
          projectId={projectId}
          projectName={projectName}
          projectDescription={hasActive ? projectDescription : null}
          projectTags={hasActive ? projectTags : []}
          isArchived={isArchived}
        />
        <div class="card-badges">
          {pausedSessions.value.length > 0 && (
            <button
              class={`card-badge badge-paused ${pausedExpanded ? "badge-active" : ""}`}
              onClick={() => toggleBadgeExpanded(key, "paused")}
              title="一時停止中のセッション"
            >
              ⏸ {pausedSessions.value.length}
            </button>
          )}
          {doneSessions.value.length > 0 && (
            <button
              class={`card-badge badge-done ${doneExpanded ? "badge-active" : ""}`}
              onClick={() => toggleBadgeExpanded(key, "done")}
              title="完了したセッション"
            >
              ✓ {doneSessions.value.length}
            </button>
          )}
        </div>
      </div>

      {/* Badge expanded sections */}
      {pausedExpanded && pausedSessions.value.length > 0 && (
        <div class="badge-expanded-section">
          <div class="badge-expanded-label">一時停止中</div>
          <div class="badge-expanded-list">
            {pausedSessions.value.map((s) => (
              <BadgeSessionCard key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}
      {doneExpanded && doneSessions.value.length > 0 && (
        <div class="badge-expanded-section">
          <div class="badge-expanded-label">完了</div>
          <div class="badge-expanded-list">
            {doneSessions.value.slice(0, 5).map((s) => (
              <BadgeSessionCard key={s.id} session={s} />
            ))}
            {doneSessions.value.length > 5 && (
              <div class="badge-expanded-more">他 {doneSessions.value.length - 5} 件</div>
            )}
          </div>
        </div>
      )}

      {/* Card Body */}
      {hasActive ? (
        <div class="project-card-body">
          <div class="active-sessions-area">
            {activeSessions.value.map((s) => (
              <ActiveSessionCard key={s.id} session={s} />
            ))}
            {!isArchived && (
              <>
                {addingSession.value ? (
                  <div class="card-add-form">
                    <input
                      type="text"
                      placeholder="セッション名..."
                      value={newSessionTitle.value}
                      onInput={(e) => (newSessionTitle.value = (e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSession();
                        if (e.key === "Escape") (addingSession.value = false);
                      }}
                      // biome-ignore lint: autofocus is intentional
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    class="btn-ghost card-add-btn"
                    onClick={() => (addingSession.value = true)}
                  >
                    + セッション追加
                  </button>
                )}
              </>
            )}
          </div>
          <TasksCell
            projectId={projectId}
            todos={projectTodos.value}
            isArchived={isArchived}
            viewMode="card"
          />
        </div>
      ) : (
        <TasksCell
          projectId={projectId}
          todos={projectTodos.value}
          isArchived={isArchived}
          viewMode="card"
        />
      )}

      {/* Session inline detail */}
      {expandedInThisCard.value && (
        <div class="card-detail-row">
          <SessionInlineDetail />
        </div>
      )}
    </div>
  );
}
