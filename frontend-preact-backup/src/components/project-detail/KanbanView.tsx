import { useSignal } from "@preact/signals";
import type { Todo } from "../../lib/api";
import { addTodo, toggleTodo, editTodo, removeTodo } from "../../stores/todo-store";

interface Props {
  todos: Todo[];
  projectId: string;
}

type ColumnStatus = "pending" | "in_progress" | "completed";

const COLUMNS: { status: ColumnStatus; label: string; color: string }[] = [
  { status: "pending", label: "未着手", color: "text-app-text-muted" },
  { status: "in_progress", label: "進行中", color: "text-app-accent" },
  { status: "completed", label: "完了", color: "text-app-success" },
];

const DONE_LIMIT = 5;

function priorityLabel(p: string) {
  if (p === "high") return { text: "!!!", cls: "text-app-danger" };
  if (p === "medium") return { text: "!!", cls: "text-app-warning" };
  return null;
}

function KanbanCard({
  todo,
  onDragStart,
}: {
  todo: Todo;
  onDragStart: (e: DragEvent, todoId: string) => void;
}) {
  const editing = useSignal(false);
  const editTitle = useSignal(todo.title);
  const isCompleted = todo.status === "completed";
  const priority = priorityLabel(todo.priority);

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
      class={`group rounded-md border border-app-border bg-app-bg p-2.5 cursor-grab active:cursor-grabbing hover:border-app-accent transition-colors ${
        isCompleted ? "opacity-50" : ""
      }`}
      draggable
      onDragStart={(e) => onDragStart(e as DragEvent, todo.id)}
    >
      <div class="flex items-start gap-2">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={() => toggleTodo(todo.id, todo.status)}
          class="w-3.5 h-3.5 mt-0.5 accent-[var(--accent)] cursor-pointer flex-shrink-0"
        />
        {editing.value ? (
          <input
            type="text"
            class="flex-1 text-sm bg-app-surface border border-app-border rounded px-1.5 py-0.5 outline-none focus:border-app-accent"
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
            class={`text-sm flex-1 min-w-0 ${
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
      {(priority || (todo.tags && todo.tags.length > 0)) && (
        <div class="flex items-center gap-1.5 flex-wrap mt-1.5 pl-5 text-xs">
          {priority && <span class={`font-medium ${priority.cls}`}>{priority.text}</span>}
          {todo.tags?.map((tag) => (
            <span key={tag.id} class="px-1.5 py-0.5 rounded-full bg-app-surface text-app-text-muted">
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  color,
  todos,
  projectId,
  onDragStart,
  onDrop,
}: {
  status: ColumnStatus;
  label: string;
  color: string;
  todos: Todo[];
  projectId: string;
  onDragStart: (e: DragEvent, todoId: string) => void;
  onDrop: (todoId: string, newStatus: ColumnStatus) => void;
}) {
  const dragOver = useSignal(false);
  const showAll = useSignal(false);
  const adding = useSignal(false);
  const newTitle = useSignal("");

  const isCompleted = status === "completed";
  const visibleTodos = isCompleted && !showAll.value ? todos.slice(0, DONE_LIMIT) : todos;
  const hasMore = isCompleted && todos.length > DONE_LIMIT;

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    dragOver.value = true;
  };

  const handleDragLeave = () => {
    dragOver.value = false;
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragOver.value = false;
    const todoId = e.dataTransfer?.getData("text/plain");
    if (todoId) onDrop(todoId, status);
  };

  const handleAdd = async () => {
    const title = newTitle.value.trim();
    if (!title) return;
    await addTodo({ title, project_id: projectId });
    newTitle.value = "";
    adding.value = false;
  };

  return (
    <div
      class={`flex flex-col min-w-[240px] flex-1 rounded-lg border transition-colors ${
        dragOver.value ? "border-app-accent bg-app-surface-hover" : "border-app-border bg-app-surface"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-app-border">
        <span class={`text-xs font-semibold uppercase tracking-wide ${color}`}>
          {label} ({todos.length})
        </span>
        {status === "pending" && (
          <button
            class="text-xs text-app-accent hover:text-app-accent-hover"
            onClick={() => (adding.value = !adding.value)}
          >
            +
          </button>
        )}
      </div>

      <div class="flex flex-col gap-2 p-2 flex-1 overflow-y-auto max-h-[60vh]">
        {adding.value && (
          <div class="flex gap-1.5">
            <input
              type="text"
              class="flex-1 text-sm bg-app-bg border border-app-border rounded px-2 py-1 outline-none focus:border-app-accent"
              placeholder="タスク名..."
              value={newTitle.value}
              onInput={(e) => (newTitle.value = (e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") adding.value = false;
              }}
              autoFocus
            />
          </div>
        )}
        {visibleTodos.map((t) => (
          <KanbanCard key={t.id} todo={t} onDragStart={onDragStart} />
        ))}
        {hasMore && !showAll.value && (
          <button
            class="text-xs text-app-text-muted hover:text-app-text text-center py-1"
            onClick={() => (showAll.value = true)}
          >
            +{todos.length - DONE_LIMIT} 件を表示
          </button>
        )}
        {todos.length === 0 && !adding.value && (
          <p class="text-xs text-app-text-muted text-center py-3">なし</p>
        )}
      </div>
    </div>
  );
}

export function KanbanView({ todos, projectId }: Props) {
  const parents = todos.filter((t) => !t.parent_id);

  const columns = COLUMNS.map((col) => ({
    ...col,
    todos: parents.filter((t) => t.status === col.status).sort((a, b) => a.sort_order - b.sort_order),
  }));

  const handleDragStart = (e: DragEvent, todoId: string) => {
    e.dataTransfer?.setData("text/plain", todoId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (todoId: string, newStatus: ColumnStatus) => {
    const todo = parents.find((t) => t.id === todoId);
    if (!todo || todo.status === newStatus) return;
    await editTodo(todoId, { status: newStatus });
  };

  return (
    <section class="mb-6">
      <div class="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            label={col.label}
            color={col.color}
            todos={col.todos}
            projectId={projectId}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </section>
  );
}
