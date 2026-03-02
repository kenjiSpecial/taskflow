import { useEffect } from "preact/hooks";
import { loadTodos } from "./stores/todo-store";
import { loadSessions } from "./stores/session-store";
import { loadProjects } from "./stores/project-store";
import { loadTags } from "./stores/tag-store";
import { MatrixView } from "./components/MatrixView";

export function App() {
  useEffect(() => {
    loadProjects();
    loadTodos();
    loadSessions();
    loadTags();
  }, []);

  return (
    <div class="app-container">
      <MatrixView />
    </div>
  );
}
