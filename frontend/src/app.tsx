import { useEffect } from "preact/hooks";
import { loadTodos, loadProjects, activeCount } from "./stores/todo-store";
import { currentView, selectedSessionId } from "./stores/app-store";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TodoForm } from "./components/TodoForm";
import { FilterBar } from "./components/FilterBar";
import { TodoList } from "./components/TodoList";
import { ViewToggle } from "./components/ViewToggle";
import { SessionDashboard } from "./components/SessionDashboard";
import { SessionDetail } from "./components/SessionDetail";

export function App() {
  useEffect(() => {
    loadTodos();
    loadProjects();
  }, []);

  return (
    <div class={currentView.value === "tasks" ? "layout" : "layout layout-full"}>
      {currentView.value === "tasks" && <ProjectSidebar />}
      <main class="main">
        <ViewToggle />
        {currentView.value === "tasks" ? (
          <>
            <div class="header">
              <h1>TODO</h1>
              <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                {activeCount.value}件のアクティブタスク
              </span>
            </div>
            <TodoForm />
            <FilterBar />
            <TodoList />
          </>
        ) : selectedSessionId.value ? (
          <SessionDetail />
        ) : (
          <SessionDashboard />
        )}
      </main>
    </div>
  );
}
