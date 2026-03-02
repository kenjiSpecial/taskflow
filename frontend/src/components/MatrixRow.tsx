import { useComputed } from "@preact/signals";
import { sessions } from "../stores/session-store";
import { todos } from "../stores/todo-store";
import { expandedSessionId } from "../stores/app-store";
import { ProjectCell } from "./ProjectCell";
import { SessionCell } from "./SessionCell";
import { TasksCell } from "./TasksCell";
import { SessionInlineDetail } from "./SessionInlineDetail";
import type { Tag } from "../lib/api";

interface Props {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  projectDescription: string | null;
  projectTags: Tag[];
  isArchived: boolean;
}

export function MatrixRow({ projectId, projectName, projectColor, projectDescription, projectTags, isArchived }: Props) {
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

  const expandedInThisRow = useComputed(() => {
    const eid = expandedSessionId.value;
    if (!eid) return false;
    return projectSessions.value.some((s) => s.id === eid);
  });

  return (
    <>
      <ProjectCell
        projectId={projectId}
        projectName={projectName}
        projectColor={projectColor}
        projectDescription={projectDescription}
        projectTags={projectTags}
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
