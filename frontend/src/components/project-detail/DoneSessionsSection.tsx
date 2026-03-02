import { useSignal } from "@preact/signals";
import type { WorkSession } from "../../lib/api";
import { detailExpandedSessionId } from "../../stores/app-store";
import { SessionDetailPanel } from "./SessionDetailPanel";

const DONE_LIMIT = 3;

interface Props {
  sessions: WorkSession[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DoneSessionsSection({ sessions }: Props) {
  const expanded = useSignal(false);
  const done = sessions.filter((s) => s.status === "done");

  if (done.length === 0) return null;

  const visible = expanded.value ? done : done.slice(0, DONE_LIMIT);

  return (
    <section class="mb-6">
      <button
        class="text-sm font-semibold text-app-text-muted uppercase tracking-wide mb-3 flex items-center gap-2 hover:text-app-text"
        onClick={() => (expanded.value = !expanded.value)}
        aria-expanded={expanded.value}
      >
        <span class="text-[0.625rem]">{expanded.value ? "▼" : "▶"}</span>
        <span class="w-2 h-2 rounded-full bg-[var(--low)]" />
        完了セッション
        <span class="text-xs font-normal">({done.length})</span>
      </button>
      <div class="flex flex-col gap-2">
        {visible.map((session) => (
          <div key={session.id}>
            <div
              class={`rounded-lg bg-app-surface border p-3 opacity-70 hover:opacity-100 transition-opacity cursor-pointer ${
                detailExpandedSessionId.value === session.id ? "border-app-accent opacity-100" : "border-app-border"
              }`}
              onClick={() => {
                detailExpandedSessionId.value =
                  detailExpandedSessionId.value === session.id ? null : session.id;
              }}
            >
              <div class="flex items-center justify-between">
                <span class="font-medium text-sm">{session.title}</span>
                <span class="text-xs text-app-text-muted">{formatDate(session.updated_at)}</span>
              </div>
              {session.task_total > 0 && (
                <span class="text-xs text-app-text-muted mt-1">
                  {session.task_completed}/{session.task_total} タスク完了
                </span>
              )}
            </div>
            {detailExpandedSessionId.value === session.id && (
              <SessionDetailPanel sessionId={session.id} />
            )}
          </div>
        ))}
      </div>
      {!expanded.value && done.length > DONE_LIMIT && (
        <button
          class="text-xs text-app-text-muted hover:text-app-accent mt-2"
          onClick={() => (expanded.value = true)}
        >
          + 他 {done.length - DONE_LIMIT} 件を表示
        </button>
      )}
    </section>
  );
}
