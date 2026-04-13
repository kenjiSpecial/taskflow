import { useComputed, useSignal } from "@preact/signals";
import { visibleProjects } from "../stores/project-store";
import { todos } from "../stores/todo-store";
import { sessions } from "../stores/session-store";
import { MatrixHeader } from "./MatrixHeader";
import { MatrixRow } from "./MatrixRow";

export type MatrixViewMode = "card" | "matrix";

const STORAGE_KEY = "taskflow-matrix-view-mode";

function getStoredViewMode(): MatrixViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "card" || v === "matrix") return v;
  } catch {}
  return "card";
}

export function MatrixView() {
  const viewMode = useSignal<MatrixViewMode>(getStoredViewMode());

  const handleViewChange = (mode: MatrixViewMode) => {
    viewMode.value = mode;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  };

  const uncategorizedExists = useComputed(() =>
    todos.value.some((t) => !t.project_id && t.status !== "completed") ||
    sessions.value.some((s) => !s.project_id),
  );

  // ソート: Activeセッション有りプロジェクトを上に
  const sortedProjects = useComputed(() => {
    const projects = [...visibleProjects.value];
    return projects.sort((a, b) => {
      const aHasActive = sessions.value.some((s) => s.project_id === a.id && s.status === "active");
      const bHasActive = sessions.value.some((s) => s.project_id === b.id && s.status === "active");
      if (aHasActive && !bHasActive) return -1;
      if (!aHasActive && bHasActive) return 1;
      return 0;
    });
  });

  const rows = sortedProjects.value.map((project) => (
    <MatrixRow
      key={project.id}
      projectId={project.id}
      projectName={project.name}
      projectColor={project.color}
      projectDescription={project.description}
      projectTags={project.tags ?? []}
      isArchived={!!project.archived_at}
      viewMode={viewMode.value}
    />
  ));

  const uncategorizedRow = uncategorizedExists.value && (
    <MatrixRow
      key="_uncategorized"
      projectId={null}
      projectName="(未分類)"
      projectColor={null}
      projectDescription={null}
      projectTags={[]}
      isArchived={false}
      viewMode={viewMode.value}
    />
  );

  return (
    <div class="matrix-container">
      <MatrixHeader viewMode={viewMode.value} onViewChange={handleViewChange} />
      {viewMode.value === "card" ? (
        <div class="card-list">
          {rows}
          {uncategorizedRow}
        </div>
      ) : (
        <div class="matrix">
          <div class="matrix-header-cell">Project</div>
          <div class="matrix-header-cell">Active</div>
          <div class="matrix-header-cell">タスク</div>
          {rows}
          {uncategorizedRow}
        </div>
      )}
    </div>
  );
}
