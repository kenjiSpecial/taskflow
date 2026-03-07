import { useEffect } from "preact/hooks";
import { Router, Route, Switch } from "wouter-preact";
import { useHashLocation } from "wouter-preact/use-hash-location";
import { loadTodos } from "./stores/todo-store";
import { loadSessions } from "./stores/session-store";
import { loadProjects } from "./stores/project-store";
import { loadTags } from "./stores/tag-store";
import { connectRealtime, disconnectRealtime } from "./stores/realtime-store";
import { RealtimeNoticeToast } from "./components/RealtimeNoticeToast";
import { MatrixView } from "./components/MatrixView";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { NotFound } from "./pages/NotFound";

export function App() {
  useEffect(() => {
    let disposed = false;

    void (async () => {
      await Promise.allSettled([
        loadProjects(),
        loadTodos(),
        loadSessions(),
        loadTags(),
      ]);

      if (!disposed) {
        connectRealtime();
      }
    })();

    return () => {
      disposed = true;
      disconnectRealtime();
    };
  }, []);

  return (
    <Router hook={useHashLocation}>
      <div class="app-container">
        <RealtimeNoticeToast />
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
