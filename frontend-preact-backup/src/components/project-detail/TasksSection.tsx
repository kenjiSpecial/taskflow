import { useSignal } from "@preact/signals";
import type { Todo } from "../../lib/api";
import { addTodo, toggleTodo, editTodo, removeTodo } from "../../stores/todo-store";

interface Props {
  todos: Todo[];
  projectId: string;
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
  const editing = useSignal(false);
  const editTitle = useSignal(todo.title);
  const isCompleted = todo.status === "completed";

  const handleToggle = async () => {
    await toggleTodo(todo.id, todo.status);
  };

  const handleSave = async () => {
    const title = editTitle.value.trim();
    if (!title) { editing.value = false; return; }
    if (title !== todo.title) {
      await editTodo(todo.id, { title });
    }
    editing.value = false;
  };

  const handleDelete = async () => {
    if (!window.confirm(`タスク「${todo.title}」を削除しますか？`)) return;
    await removeTodo(todo.id);
  };

  return (
    <div class="group">
      <div class="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-app-surface-hover">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={handleToggle}
          class="w-4 h-4 accent-[var(--accent)] cursor-pointer flex-shrink-0"
        />
        {editing.value ? (
          <input
            type="text"
            class="flex-1 text-sm bg-app-surface border border-app-border rounded px-2 py-0.5 outline-none focus:border-app-accent"
            value={editTitle.value}
            onInput={(e) => (editTitle.value = (e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") (editing.value = false);
            }}
            // biome-ignore lint: autofocus is intentional
            autoFocus
          />
        ) : (
          <span
            class={`text-sm flex-1 min-w-0 truncate cursor-pointer ${isCompleted ? "line-through text-app-text-muted" : ""}`}
            onDblClick={() => {
              editTitle.value = todo.title;
              editing.value = true;
            }}
          >
            {todo.title}
          </span>
        )}
        {!editing.value && todo.priority !== "low" && (
          <span class={`text-xs font-medium ${priorityColor(todo.priority)}`}>
            {todo.priority === "high" ? "!!!" : "!!"}
          </span>
        )}
        {!editing.value && todo.tags && todo.tags.length > 0 && (
          <div class="flex gap-1 flex-shrink-0">
            {todo.tags.map((tag) => (
              <span key={tag.id} class="text-[0.625rem] px-1.5 rounded-full bg-app-surface text-app-text-muted">
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <button
          class="text-xs text-app-text-muted hover:text-app-danger opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={handleDelete}
          title="削除"
        >
          ✕
        </button>
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

export function TasksSection({ todos, projectId }: Props) {
  const showCompleted = useSignal(false);
  const adding = useSignal(false);
  const newTitle = useSignal("");
  const { inProgress, pending, completed, childMap } = groupByStatus(todos);

  const handleAdd = async () => {
    const title = newTitle.value.trim();
    if (!title) return;
    await addTodo({ title, project_id: projectId });
    newTitle.value = "";
    adding.value = false;
  };

  return (
    <section class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-app-text-muted uppercase tracking-wide">
          タスク
          {todos.length > 0 && (
            <span class="text-xs font-normal ml-2">({todos.filter((t) => t.status !== "completed").length} 未完了)</span>
          )}
        </h2>
        <button
          class="text-xs text-app-accent hover:text-app-accent-hover"
          onClick={() => (adding.value = !adding.value)}
        >
          + 追加
        </button>
      </div>

      {adding.value && (
        <div class="flex gap-2 mb-3">
          <input
            type="text"
            class="flex-1 text-sm bg-app-surface border border-app-border rounded-md px-3 py-1.5 outline-none focus:border-app-accent"
            placeholder="タスク名..."
            value={newTitle.value}
            onInput={(e) => (newTitle.value = (e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") (adding.value = false);
            }}
            // biome-ignore lint: autofocus is intentional
            autoFocus
          />
          <button class="text-xs bg-app-accent text-white rounded-md px-3 py-1.5 hover:bg-app-accent-hover" onClick={handleAdd}>
            追加
          </button>
        </div>
      )}

      {todos.length === 0 && !adding.value && (
        <p class="text-sm text-app-text-muted py-4 text-center">タスクはまだありません</p>
      )}

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
            aria-expanded={showCompleted.value}
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
