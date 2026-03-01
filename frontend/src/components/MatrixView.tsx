import { computed } from "@preact/signals";
import { visibleProjects } from "../stores/project-store";
import { todos } from "../stores/todo-store";
import { sessions } from "../stores/session-store";
import { MatrixHeader } from "./MatrixHeader";
import { MatrixRow } from "./MatrixRow";

export function MatrixView() {
  const uncategorizedExists = computed(() =>
    todos.value.some((t) => !t.project_id && t.status !== "completed") ||
    sessions.value.some((s) => !s.project_id),
  );

  return (
    <div class="matrix-container">
      <MatrixHeader />
      <div class="matrix">
        {/* Header row */}
        <div class="matrix-header-cell" />
        <div class="matrix-header-cell">Active</div>
        <div class="matrix-header-cell">Paused</div>
        <div class="matrix-header-cell">Done</div>
        <div class="matrix-header-cell">タスク</div>

        {/* Project rows */}
        {visibleProjects.value.map((project) => (
          <MatrixRow
            key={project.id}
            projectId={project.id}
            projectName={project.name}
            projectColor={project.color}
            isArchived={!!project.archived_at}
          />
        ))}

        {/* Uncategorized row */}
        {uncategorizedExists.value && (
          <MatrixRow
            key="_uncategorized"
            projectId={null}
            projectName="(未分類)"
            projectColor={null}
            isArchived={false}
          />
        )}
      </div>
    </div>
  );
}
