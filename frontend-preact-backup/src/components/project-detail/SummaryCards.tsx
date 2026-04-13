import type { Todo, WorkSession } from "../../lib/api";

interface Props {
  todos: Todo[];
  sessions: WorkSession[];
}

export function SummaryCards({ todos, sessions }: Props) {
  const activeSessions = sessions.filter((s) => s.status === "active").length;
  const pausedSessions = sessions.filter((s) => s.status === "paused").length;
  const completedTasks = todos.filter((t) => t.status === "completed").length;
  const totalTasks = todos.length;

  return (
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      <div class="rounded-lg bg-app-surface border border-app-border p-4">
        <div class="text-xs text-app-text-muted uppercase tracking-wide mb-1">アクティブ</div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold text-app-success">{activeSessions}</span>
          <span class="text-sm text-app-text-muted">セッション</span>
        </div>
      </div>

      <div class="rounded-lg bg-app-surface border border-app-border p-4">
        <div class="text-xs text-app-text-muted uppercase tracking-wide mb-1">一時停止</div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold text-app-warning">{pausedSessions}</span>
          <span class="text-sm text-app-text-muted">セッション</span>
        </div>
      </div>

      <div class="rounded-lg bg-app-surface border border-app-border p-4">
        <div class="text-xs text-app-text-muted uppercase tracking-wide mb-1">タスク進捗</div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-bold text-app-text">
            {completedTasks}<span class="text-sm text-app-text-muted font-normal">/{totalTasks}</span>
          </span>
        </div>
        {totalTasks > 0 && (
          <div class="mt-2 h-1.5 bg-app-border rounded-full overflow-hidden">
            <div
              class="h-full bg-app-success rounded-full transition-all"
              style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
