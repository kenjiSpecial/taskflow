import type { WorkSession } from "../../lib/api";

interface Props {
  sessions: WorkSession[];
}

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function ActiveSessionsSection({ sessions }: Props) {
  const active = sessions.filter((s) => s.status === "active");

  if (active.length === 0) return null;

  return (
    <section class="mb-6">
      <h2 class="text-sm font-semibold text-app-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-app-success" />
        アクティブセッション
        <span class="text-xs font-normal">({active.length})</span>
      </h2>
      <div class="flex flex-col gap-2">
        {active.map((session) => (
          <div
            key={session.id}
            class="rounded-lg bg-app-surface border border-app-border p-3 hover:border-app-accent transition-colors cursor-pointer"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium text-sm">{session.title}</span>
              <span class="text-xs text-app-success font-medium">{formatElapsed(session.updated_at)}</span>
            </div>
            {session.task_total > 0 && (
              <div class="flex items-center gap-2 mt-1">
                <div class="flex-1 h-1 bg-app-border rounded-full overflow-hidden">
                  <div
                    class="h-full bg-app-success rounded-full"
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
