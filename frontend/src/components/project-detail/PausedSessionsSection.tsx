import type { WorkSession } from "../../lib/api";

interface Props {
  sessions: WorkSession[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PausedSessionsSection({ sessions }: Props) {
  const paused = sessions.filter((s) => s.status === "paused");

  if (paused.length === 0) return null;

  return (
    <section class="mb-6">
      <h2 class="text-sm font-semibold text-app-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-app-warning" />
        一時停止中
        <span class="text-xs font-normal">({paused.length})</span>
      </h2>
      <div class="flex flex-col gap-2">
        {paused.map((session) => (
          <div
            key={session.id}
            class="rounded-lg bg-app-surface border border-app-border p-3 hover:border-app-accent transition-colors cursor-pointer"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium text-sm">{session.title}</span>
              <span class="text-xs text-app-text-muted">{formatDate(session.updated_at)}</span>
            </div>
            {session.task_total > 0 && (
              <div class="flex items-center gap-2 mt-1">
                <div class="flex-1 h-1 bg-app-border rounded-full overflow-hidden">
                  <div
                    class="h-full bg-app-warning rounded-full"
                    style={{ width: `${(session.task_completed / session.task_total) * 100}%` }}
                  />
                </div>
                <span class="text-xs text-app-text-muted">{session.task_completed}/{session.task_total}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
