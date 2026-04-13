import { useSignal } from "@preact/signals";
import type { Todo, WorkSession } from "../../lib/api";

interface Props {
  todos: Todo[];
  sessions: WorkSession[];
}

interface TimelineEvent {
  id: string;
  type: "session" | "task";
  date: string;
  title: string;
  status: string;
  linkedTasks?: Todo[];
}

function statusDot(type: string, status: string): string {
  if (type === "session") {
    if (status === "active") return "bg-app-success";
    if (status === "paused") return "bg-app-warning";
    return "bg-app-text-muted";
  }
  if (status === "completed") return "bg-app-success";
  if (status === "in_progress") return "bg-app-accent";
  return "bg-app-border";
}

function statusLabel(type: string, status: string): { text: string; cls: string } | null {
  if (type === "session") {
    if (status === "active") return { text: "Active", cls: "text-app-success" };
    if (status === "paused") return { text: "Paused", cls: "text-app-warning" };
    return { text: "Done", cls: "text-app-text-muted" };
  }
  if (status === "completed") return { text: "完了", cls: "text-app-success" };
  if (status === "in_progress") return { text: "進行中", cls: "text-app-accent" };
  return null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${month}/${day} (${weekdays[d.getDay()]})`;
}

function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  for (const ev of events) {
    const dateKey = ev.date.split("T")[0];
    const list = groups.get(dateKey) || [];
    list.push(ev);
    groups.set(dateKey, list);
  }
  return groups;
}

const DEFAULT_DAYS = 14;

export function TimelineView({ todos, sessions }: Props) {
  const showAll = useSignal(false);

  const events: TimelineEvent[] = [];

  for (const s of sessions) {
    events.push({
      id: `s-${s.id}`,
      type: "session",
      date: s.updated_at || s.created_at,
      title: s.title,
      status: s.status,
      linkedTasks: s.linked_tasks,
    });
  }

  for (const t of todos) {
    if (!t.parent_id) {
      events.push({
        id: `t-${t.id}`,
        type: "task",
        date: t.completed_at || t.updated_at || t.created_at,
        title: t.title,
        status: t.status,
      });
    }
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_DAYS);
  const filteredEvents = showAll.value
    ? events
    : events.filter((e) => new Date(e.date) >= cutoffDate);

  const grouped = groupByDate(filteredEvents);
  const sortedDates = [...grouped.keys()].sort((a, b) => b.localeCompare(a));

  if (events.length === 0) {
    return (
      <section class="mb-6">
        <p class="text-sm text-app-text-muted py-8 text-center">
          タスクやセッションがまだありません
        </p>
      </section>
    );
  }

  return (
    <section class="mb-6">
      <div class="relative pl-6">
        {/* 垂直ライン */}
        <div class="absolute left-2.5 top-0 bottom-0 w-px bg-app-border" />

        {sortedDates.map((dateKey) => {
          const dayEvents = grouped.get(dateKey) || [];
          return (
            <div key={dateKey} class="mb-6">
              <div class="relative flex items-center mb-3 -ml-6">
                <div class="w-5 h-5 rounded-full bg-app-surface border-2 border-app-border flex items-center justify-center z-10">
                  <div class="w-2 h-2 rounded-full bg-app-text-muted" />
                </div>
                <span class="ml-2 text-sm font-semibold text-app-text">
                  {formatDate(dateKey)}
                </span>
              </div>

              <div class="flex flex-col gap-2">
                {dayEvents.map((ev) => {
                  const dot = statusDot(ev.type, ev.status);
                  const label = statusLabel(ev.type, ev.status);
                  return (
                    <div key={ev.id} class="relative flex items-start gap-3">
                      <div class={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 -ml-[17px] ${dot}`} />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-app-text-muted uppercase">
                            {ev.type === "session" ? "Session" : "Task"}
                          </span>
                          {label && (
                            <span class={`text-xs font-medium ${label.cls}`}>{label.text}</span>
                          )}
                        </div>
                        <p class={`text-sm ${
                          ev.status === "completed" || ev.status === "done"
                            ? "text-app-text-muted"
                            : "text-app-text"
                        }`}>
                          {ev.title}
                        </p>
                        {ev.linkedTasks && ev.linkedTasks.length > 0 && (
                          <div class="mt-1 pl-3 border-l border-app-border">
                            {ev.linkedTasks.map((task) => (
                              <div key={task.id} class="flex items-center gap-1.5 text-xs text-app-text-muted py-0.5">
                                <span>{task.status === "completed" ? "✓" : "○"}</span>
                                <span class={task.status === "completed" ? "line-through" : ""}>
                                  {task.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!showAll.value && events.length > filteredEvents.length && (
        <button
          class="text-xs text-app-accent hover:text-app-accent-hover mx-auto block mt-2"
          onClick={() => (showAll.value = true)}
        >
          すべて表示（{events.length - filteredEvents.length} 件）
        </button>
      )}
    </section>
  );
}
