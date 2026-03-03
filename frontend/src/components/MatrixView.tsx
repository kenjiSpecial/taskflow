import { useComputed } from "@preact/signals";
import { visibleProjects } from "../stores/project-store";
import { todos } from "../stores/todo-store";
import { sessions } from "../stores/session-store";
import { MatrixHeader } from "./MatrixHeader";
import { MatrixRow } from "./MatrixRow";

export function MatrixView() {
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

  return (
    <div class="matrix-container">
      <MatrixHeader />
      <div class="card-list">
        {sortedProjects.value.map((project) => (
          <MatrixRow
            key={project.id}
            projectId={project.id}
            projectName={project.name}
            projectColor={project.color}
            projectDescription={project.description}
            projectTags={project.tags ?? []}
            isArchived={!!project.archived_at}
          />
        ))}

        {uncategorizedExists.value && (
          <MatrixRow
            key="_uncategorized"
            projectId={null}
            projectName="(未分類)"
            projectColor={null}
            projectDescription={null}
            projectTags={[]}
            isArchived={false}
          />
        )}
      </div>
    </div>
  );
}
