import { useEffect } from "preact/hooks";
import { Router, Route, Switch } from "wouter-preact";
import { useHashLocation } from "wouter-preact/use-hash-location";
import { loadTodos } from "./stores/todo-store";
import { loadSessions } from "./stores/session-store";
import { loadProjects } from "./stores/project-store";
import { loadTags } from "./stores/tag-store";
import { MatrixView } from "./components/MatrixView";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { NotFound } from "./pages/NotFound";

export function App() {
  useEffect(() => {
    loadProjects();
    loadTodos();
    loadSessions();
    loadTags();
  }, []);

  return (
    <Router hook={useHashLocation}>
      <div class="app-container">
        <Switch>
          <Route path="/" component={MatrixView} />
          <Route path="/projects/:id">
            {(params) => <ProjectDetailPage projectId={params.id} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </div>
    </Router>
  );
}
