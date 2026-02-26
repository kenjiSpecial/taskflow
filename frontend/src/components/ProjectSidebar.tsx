import { projects, filter, activeCount } from "../stores/todo-store";

export function ProjectSidebar() {
  const setProject = (project?: string) => {
    filter.value = { ...filter.value, project };
  };

  return (
    <aside class="sidebar">
      <h2>TODO Manager</h2>
      <div
        class={`sidebar-item ${!filter.value.project ? "active" : ""}`}
        onClick={() => setProject(undefined)}
      >
        <span>すべて</span>
        <span class="count">{activeCount.value}</span>
      </div>

      {projects.value.length > 0 && (
        <>
          <h2 style={{ marginTop: "1.5rem" }}>プロジェクト</h2>
          {projects.value.map((p) => (
            <div
              key={p.project}
              class={`sidebar-item ${filter.value.project === p.project ? "active" : ""}`}
              onClick={() => setProject(p.project)}
            >
              <span>{p.project}</span>
              <span class="count">{p.count}</span>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}
