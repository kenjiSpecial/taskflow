import { useSignal } from "@preact/signals";
import type { Todo } from "../../lib/api";

interface Props {
  todos: Todo[];
}

function groupByStatus(todos: Todo[]) {
  const parents = todos.filter((t) => !t.parent_id);
  const childMap = new Map<string, Todo[]>();
  for (const t of todos) {
    if (t.parent_id) {
      const list = childMap.get(t.parent_id) || [];
      list.push(t);
      childMap.set(t.parent_id, list);
    }
  }

  const inProgress = parents.filter((t) => t.status === "in_progress").sort((a, b) => a.sort_order - b.sort_order);
  const pending = parents.filter((t) => t.status === "pending").sort((a, b) => a.sort_order - b.sort_order);
  const completed = parents.filter((t) => t.status === "completed").sort((a, b) => a.sort_order - b.sort_order);

  return { inProgress, pending, completed, childMap };
}

function priorityColor(priority: string): string {
  switch (priority) {
    case "high": return "text-app-danger";
    case "medium": return "text-app-warning";
    default: return "text-app-text-muted";
  }
}

function TodoItem({ todo, children }: { todo: Todo; children: Todo[] }) {
  const isCompleted = todo.status === "completed";

  return (
    <div class="group">
      <div class="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-app-surface-hover">
        <input
          type="checkbox"
          checked={isCompleted}
          class="w-4 h-4 accent-[var(--accent)] cursor-pointer flex-shrink-0"
          disabled
        />
        <span class={`text-sm flex-1 min-w-0 truncate ${isCompleted ? "line-through text-app-text-muted" : ""}`}>
          {todo.title}
        </span>
        {todo.priority !== "low" && (
          <span class={`text-xs font-medium ${priorityColor(todo.priority)}`}>
            {todo.priority === "high" ? "!!!" : "!!"}
          </span>
        )}
        {todo.tags && todo.tags.length > 0 && (
          <div class="flex gap-1 flex-shrink-0">
            {todo.tags.map((tag) => (
              <span key={tag.id} class="text-[0.625rem] px-1.5 py-0 rounded-full bg-app-surface text-app-text-muted">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {children.length > 0 && (
        <div class="ml-6 border-l border-app-border pl-2">
          {children.map((child) => (
            <TodoItem key={child.id} todo={child} children={[]} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TasksSection({ todos }: Props) {
  const showCompleted = useSignal(false);
  const { inProgress, pending, completed, childMap } = groupByStatus(todos);

  if (todos.length === 0) {
    return (
      <section class="mb-6">
        <h2 class="text-sm font-semibold text-app-text-muted uppercase tracking-wide mb-3">
          タスク
        </h2>
        <p class="text-sm text-app-text-muted py-4 text-center">タスクはまだありません</p>
      </section>
    );
  }

  return (
    <section class="mb-6">
      <h2 class="text-sm font-semibold text-app-text-muted uppercase tracking-wide mb-3">
        タスク
        <span class="text-xs font-normal ml-2">({todos.filter((t) => t.status !== "completed").length} 未完了)</span>
      </h2>

      {inProgress.length > 0 && (
        <div class="mb-3">
          <div class="text-xs text-app-accent font-medium mb-1 px-2">進行中 ({inProgress.length})</div>
          {inProgress.map((t) => (
            <TodoItem key={t.id} todo={t} children={childMap.get(t.id) || []} />
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div class="mb-3">
          <div class="text-xs text-app-text-muted font-medium mb-1 px-2">未着手 ({pending.length})</div>
          {pending.map((t) => (
            <TodoItem key={t.id} todo={t} children={childMap.get(t.id) || []} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <button
            class="text-xs text-app-text-muted hover:text-app-text mb-1 px-2 flex items-center gap-1"
            onClick={() => (showCompleted.value = !showCompleted.value)}
          >
            <span class="text-[0.625rem]">{showCompleted.value ? "▼" : "▶"}</span>
            完了 ({completed.length})
          </button>
          {showCompleted.value && (
            <div>
              {completed.map((t) => (
                <TodoItem key={t.id} todo={t} children={childMap.get(t.id) || []} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
