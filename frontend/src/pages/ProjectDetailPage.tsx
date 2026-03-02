import { useComputed } from "@preact/signals";
import { Link } from "wouter-preact";
import { projects, loading as projectsLoading } from "../stores/project-store";
import { todos, loading as todosLoading } from "../stores/todo-store";
import { sessions, loading as sessionsLoading } from "../stores/session-store";
import { ProjectHeader } from "../components/project-detail/ProjectHeader";
import { SummaryCards } from "../components/project-detail/SummaryCards";
import { ActiveSessionsSection } from "../components/project-detail/ActiveSessionsSection";
import { TasksSection } from "../components/project-detail/TasksSection";
import { PausedSessionsSection } from "../components/project-detail/PausedSessionsSection";
import { DoneSessionsSection } from "../components/project-detail/DoneSessionsSection";

interface Props {
  projectId: string;
}

export function ProjectDetailPage({ projectId }: Props) {
  const isLoading = useComputed(() =>
    projectsLoading.value || todosLoading.value || sessionsLoading.value
  );

  const project = useComputed(() =>
    projects.value.find((p) => p.id === projectId) ?? null
  );

  const projectTodos = useComputed(() =>
    todos.value.filter((t) => t.project_id === projectId)
  );

  const projectSessions = useComputed(() =>
    sessions.value.filter((s) => s.project_id === projectId)
  );

  // ローディング中
  if (isLoading.value && projects.value.length === 0) {
    return (
      <div class="max-w-4xl mx-auto">
        <div class="animate-pulse">
          <div class="h-4 w-24 bg-app-surface rounded mb-6" />
          <div class="h-8 w-64 bg-app-surface rounded mb-4" />
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div class="h-20 bg-app-surface rounded-lg" />
            <div class="h-20 bg-app-surface rounded-lg" />
            <div class="h-20 bg-app-surface rounded-lg" />
          </div>
          <div class="h-32 bg-app-surface rounded-lg mb-4" />
          <div class="h-48 bg-app-surface rounded-lg" />
        </div>
      </div>
    );
  }

  // プロジェクトが見つからない
  if (!project.value) {
    return (
      <div class="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h1 class="text-xl font-semibold text-app-text-muted mb-2">プロジェクトが見つかりません</h1>
        <p class="text-sm text-app-text-muted mb-4">このプロジェクトは削除されたか、存在しません。</p>
        <Link href="/" class="text-app-accent hover:text-app-accent-hover text-sm">
          MatrixView に戻る
        </Link>
      </div>
    );
  }

  return (
    <div class="max-w-4xl mx-auto">
      <ProjectHeader project={project.value} />
      <SummaryCards todos={projectTodos.value} sessions={projectSessions.value} />
      <ActiveSessionsSection sessions={projectSessions.value} projectId={projectId} />
      <TasksSection todos={projectTodos.value} projectId={projectId} />
      <PausedSessionsSection sessions={projectSessions.value} />
      <DoneSessionsSection sessions={projectSessions.value} />
    </div>
  );
}
