import { useSignal } from "@preact/signals";
import type { Todo } from "../lib/api";
import { editTodo, removeTodo, addTodo, toggleTodo, childrenMap, taskProgress } from "../stores/todo-store";

interface Props {
  todo: Todo;
}

export function TodoItem({ todo }: Props) {
  const editing = useSignal(false);
  const editTitle = useSignal(todo.title);
  const expanded = useSignal(true);
  const addingChild = useSignal(false);
  const childTitle = useSignal("");

  const handleToggle = async () => {
    await toggleTodo(todo.id, todo.status);
  };

  const handleDelete = async () => {
    await removeTodo(todo.id);
  };

  const handleEdit = async () => {
    if (editing.value) {
      const value = editTitle.value.trim();
      if (value && value !== todo.title) {
        await editTodo(todo.id, { title: value });
      }
      editing.value = false;
    } else {
      editTitle.value = todo.title;
      editing.value = true;
    }
  };

  const handleAddChild = async () => {
    const title = childTitle.value.trim();
    if (!title) return;
    await addTodo({ title, parent_id: todo.id, project: todo.project || undefined });
    childTitle.value = "";
    addingChild.value = false;
    expanded.value = true;
  };

  const priorityClass = `badge badge-${todo.priority}`;
  const priorityLabel = { high: "高", medium: "中", low: "低" }[todo.priority];
  const children = childrenMap.value.get(todo.id) || [];
  const progress = taskProgress.value.get(todo.id);
  const isChild = !!todo.parent_id;

  return (
    <div>
      <div class={`todo-item ${todo.status === "completed" ? "completed" : ""}`}>
        {children.length > 0 && (
          <button
            class="btn-toggle"
            onClick={() => (expanded.value = !expanded.value)}
          >
            {expanded.value ? "▼" : "▶"}
          </button>
        )}
        <input
          type="checkbox"
          class="todo-checkbox"
          checked={todo.status === "completed"}
          onChange={handleToggle}
        />
        <div class="todo-content">
          {editing.value ? (
            <input
              type="text"
              value={editTitle.value}
              onInput={(e) => (editTitle.value = (e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEdit();
                if (e.key === "Escape") (editing.value = false);
              }}
              // biome-ignore lint: autofocus is intentional for edit mode
              autoFocus
            />
          ) : (
            <div class="todo-title-row">
              <span class="todo-title">{todo.title}</span>
              {progress && progress.total > 0 && (
                <span class="todo-progress">
                  {progress.completed}/{progress.total}完了
                </span>
              )}
            </div>
          )}
          <div class="todo-meta">
            <span class={priorityClass}>{priorityLabel}</span>
            {todo.project && <span>{todo.project}</span>}
            {todo.due_date && <span>{todo.due_date}</span>}
          </div>
        </div>
        <div class="todo-actions">
          {!isChild && (
            <button
              class="btn-ghost"
              onClick={() => (addingChild.value = !addingChild.value)}
              title="サブタスク追加"
            >
              +
            </button>
          )}
          <button class="btn-ghost" onClick={handleEdit}>
            {editing.value ? "保存" : "編集"}
          </button>
          <button class="btn-danger" onClick={handleDelete}>
            削除
          </button>
        </div>
      </div>
      {addingChild.value && (
        <div class="todo-children">
          <div class="subtask-form">
            <input
              type="text"
              placeholder="サブタスクを追加..."
              value={childTitle.value}
              onInput={(e) => (childTitle.value = (e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddChild();
                if (e.key === "Escape") (addingChild.value = false);
              }}
              // biome-ignore lint: autofocus is intentional for inline form
              autoFocus
            />
            <button class="btn-primary" style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }} onClick={handleAddChild}>
              追加
            </button>
          </div>
        </div>
      )}
      {expanded.value && children.length > 0 && (
        <div class="todo-children">
          {children.map((child) => (
            <TodoItem key={child.id} todo={child} />
          ))}
        </div>
      )}
    </div>
  );
}
