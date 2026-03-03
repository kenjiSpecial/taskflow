import { useSignal } from "@preact/signals";
import type { Todo } from "../../lib/api";
import { addTodo, toggleTodo, editTodo, removeTodo } from "../../stores/todo-store";

interface Props {
  todos: Todo[];
  projectId: string;
}

function priorityLabel(p: string) {
  if (p === "high") return { text: "!!!", cls: "text-app-danger" };
  if (p === "medium") return { text: "!!", cls: "text-app-warning" };
  return null;
}

function dueDateLabel(d: string | null) {
  if (!d) return null;
  const due = new Date(d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const overdue = due < now;
  const mm = String(due.getMonth() + 1).padStart(2, "0");
  const dd = String(due.getDate()).padStart(2, "0");
  return { text: `${mm}/${dd}`, overdue };
}

function TaskCard({ todo, children }: { todo: Todo; children: Todo[] }) {
  const editing = useSignal(false);
  const editTitle = useSignal(todo.title);
  const isCompleted = todo.status === "completed";
  const priority = priorityLabel(todo.priority);
  const dueDate = dueDateLabel(todo.due_date ?? null);
  const completedChildren = children.filter((c) => c.status === "completed").length;

  const handleToggle = async () => {
    await toggleTodo(todo.id, todo.status);
  };

  const handleSave = async () => {
    const title = editTitle.value.trim();
    if (!title) { editing.value = false; return; }
    if (title !== todo.title) await editTodo(todo.id, { title });
    editing.value = false;
  };

  const handleDelete = async () => {
    if (!window.confirm(`タスク「${todo.title}」を削除しますか？`)) return;
    await removeTodo(todo.id);
  };

  return (
    <div
      class={`group rounded-lg border border-app-border bg-app-surface p-3 hover:border-app-accent transition-colors ${
        isCompleted ? "opacity-50" : ""
      }`}
    >
      <div class="flex items-start gap-2 mb-2">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={handleToggle}
          class="w-4 h-4 mt-0.5 accent-[var(--accent)] cursor-pointer flex-shrink-0"
        />
        {editing.value ? (
          <input
            type="text"
            class="flex-1 text-sm bg-app-bg border border-app-border rounded px-2 py-0.5 outline-none focus:border-app-accent"
            value={editTitle.value}
            onInput={(e) => (editTitle.value = (e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") editing.value = false;
            }}
            autoFocus
          />
        ) : (
          <span
            class={`text-sm font-medium flex-1 min-w-0 cursor-pointer ${
              isCompleted ? "line-through text-app-text-muted" : "text-app-text"
            }`}
            onDblClick={() => {
              editTitle.value = todo.title;
              editing.value = true;
            }}
          >
            {todo.title}
          </span>
        )}
        <button
          class="text-xs text-app-text-muted hover:text-app-danger opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={handleDelete}
          title="削除"
        >
          ✕
        </button>
      </div>

      <div class="flex items-center gap-2 flex-wrap text-xs pl-6">
        {priority && (
          <span class={`font-medium ${priority.cls}`}>{priority.text}</span>
        )}
        {todo.tags && todo.tags.length > 0 && todo.tags.map((tag) => (
          <span key={tag.id} class="px-1.5 py-0.5 rounded-full bg-app-bg text-app-text-muted">
            {tag.name}
          </span>
        ))}
        {dueDate && (
          <span class={dueDate.overdue ? "text-app-danger" : "text-app-text-muted"}>
            {dueDate.text}
          </span>
        )}
      </div>

      {children.length > 0 && (
        <div class="mt-2 pl-6">
          <div class="flex items-center gap-2">
            <div class="flex-1 h-1.5 bg-app-border rounded-full overflow-hidden">
              <div
                class="h-full bg-app-success rounded-full transition-all"
                style={{ width: `${(completedChildren / children.length) * 100}%` }}
              />
            </div>
            <span class="text-xs text-app-text-muted">{completedChildren}/{children.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function CardView({ todos, projectId }: Props) {
  const adding = useSignal(false);
  const newTitle = useSignal("");

  const parents = todos.filter((t) => !t.parent_id);
  const childMap = new Map<string, Todo[]>();
  for (const t of todos) {
    if (t.parent_id) {
      const list = childMap.get(t.parent_id) || [];
      list.push(t);
      childMap.set(t.parent_id, list);
    }
  }

  // ソート: 進行中 → 未着手 → 完了、各グループ内はsort_order
  const statusOrder = { in_progress: 0, pending: 1, completed: 2 };
  const sorted = [...parents].sort((a, b) => {
    const so = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    if (so !== 0) return so;
    return a.sort_order - b.sort_order;
  });

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
            <span class="text-xs font-normal ml-2">
              ({todos.filter((t) => t.status !== "completed").length} 未完了)
            </span>
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
              if (e.key === "Escape") adding.value = false;
            }}
            autoFocus
          />
          <button class="text-xs bg-app-accent text-white rounded-md px-3 py-1.5 hover:bg-app-accent-hover" onClick={handleAdd}>
            追加
          </button>
        </div>
      )}

      {sorted.length === 0 && !adding.value && (
        <p class="text-sm text-app-text-muted py-4 text-center">タスクはまだありません</p>
      )}

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((t) => (
          <TaskCard key={t.id} todo={t} children={childMap.get(t.id) || []} />
        ))}
      </div>
    </section>
  );
}
