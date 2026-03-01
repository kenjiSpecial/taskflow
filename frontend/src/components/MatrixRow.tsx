import { computed } from "@preact/signals";
import { sessions } from "../stores/session-store";
import { todos } from "../stores/todo-store";
import { expandedSessionId } from "../stores/app-store";
import { ProjectCell } from "./ProjectCell";
import { SessionCell } from "./SessionCell";
import { TasksCell } from "./TasksCell";
import { SessionInlineDetail } from "./SessionInlineDetail";

interface Props {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  isArchived: boolean;
}

export function MatrixRow({ projectId, projectName, projectColor, isArchived }: Props) {
  const projectSessions = computed(() =>
    sessions.value.filter((s) =>
      projectId === null ? !s.project_id : s.project_id === projectId,
    ),
  );

  const activeSessions = computed(() =>
    projectSessions.value.filter((s) => s.status === "active"),
  );
  const pausedSessions = computed(() =>
    projectSessions.value.filter((s) => s.status === "paused"),
  );
  const doneSessions = computed(() =>
    projectSessions.value
      .filter((s) => s.status === "done")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  );

  const projectTodos = computed(() =>
    todos.value.filter((t) =>
      projectId === null ? !t.project_id : t.project_id === projectId,
    ),
  );

  // このプロジェクト行のセッションが展開されているかチェック
  const expandedInThisRow = computed(() => {
    const eid = expandedSessionId.value;
    if (!eid) return false;
    return projectSessions.value.some((s) => s.id === eid);
  });

  const rowClass = isArchived ? "matrix-row matrix-row-archived" : "matrix-row";

  return (
    <>
      <ProjectCell
        projectId={projectId}
        projectName={projectName}
        projectColor={projectColor}
        isArchived={isArchived}
      />
      <SessionCell
        sessions={activeSessions.value}
        status="active"
        projectId={projectId}
        isArchived={isArchived}
      />
      <SessionCell
        sessions={pausedSessions.value}
        status="paused"
        projectId={projectId}
        isArchived={isArchived}
      />
      <SessionCell
        sessions={doneSessions.value}
        status="done"
        projectId={projectId}
        isArchived={isArchived}
      />
      <TasksCell
        projectId={projectId}
        todos={projectTodos.value}
        isArchived={isArchived}
      />

      {/* Inline session detail - full width row */}
      {expandedInThisRow.value && (
        <div class="matrix-detail-row">
          <SessionInlineDetail />
        </div>
      )}
    </>
  );
}
