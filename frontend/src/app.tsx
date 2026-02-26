import { useEffect } from "preact/hooks";
import { loadTodos, loadProjects, activeCount } from "./stores/todo-store";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TodoForm } from "./components/TodoForm";
import { FilterBar } from "./components/FilterBar";
import { TodoList } from "./components/TodoList";

export function App() {
  useEffect(() => {
    loadTodos();
    loadProjects();
  }, []);

  return (
    <div class="layout">
      <ProjectSidebar />
      <main class="main">
        <div class="header">
          <h1>TODO</h1>
          <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            {activeCount.value}件のアクティブタスク
          </span>
        </div>
        <TodoForm />
        <FilterBar />
        <TodoList />
      </main>
    </div>
  );
}
