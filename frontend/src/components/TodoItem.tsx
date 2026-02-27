import { useSignal } from "@preact/signals";
import type { Todo } from "../lib/api";
import { editTodo, removeTodo, childrenMap } from "../stores/todo-store";

interface Props {
  todo: Todo;
}

export function TodoItem({ todo }: Props) {
  const editing = useSignal(false);
  const editTitle = useSignal(todo.title);

  const toggleStatus = async () => {
    const newStatus = todo.status === "completed" ? "pending" : "completed";
    await editTodo(todo.id, { status: newStatus });
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

  const priorityClass = `badge badge-${todo.priority}`;
  const priorityLabel = { high: "高", medium: "中", low: "低" }[todo.priority];
  const children = childrenMap.value.get(todo.id) || [];

  return (
    <div>
      <div class={`todo-item ${todo.status === "completed" ? "completed" : ""}`}>
        <input
          type="checkbox"
          class="todo-checkbox"
          checked={todo.status === "completed"}
          onChange={toggleStatus}
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
            <div class="todo-title">{todo.title}</div>
          )}
          <div class="todo-meta">
            <span class={priorityClass}>{priorityLabel}</span>
            {todo.project && <span>{todo.project}</span>}
            {todo.due_date && <span>{todo.due_date}</span>}
          </div>
        </div>
        <div class="todo-actions">
          <button class="btn-ghost" onClick={handleEdit}>
            {editing.value ? "保存" : "編集"}
          </button>
          <button class="btn-danger" onClick={handleDelete}>
            削除
          </button>
        </div>
      </div>
      {children.length > 0 && (
        <div class="todo-children">
          {children.map((child) => (
            <TodoItem key={child.id} todo={child} />
          ))}
        </div>
      )}
    </div>
  );
}
