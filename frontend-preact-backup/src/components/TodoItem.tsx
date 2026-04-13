import { useSignal } from "@preact/signals";
import type { Todo } from "../lib/api";
import { editTodo, removeTodo, addTodo, toggleTodo, childrenMap, taskProgress, dragState, reorderTodosAction, parentTodos, todos } from "../stores/todo-store";

interface Props {
  todo: Todo;
}

function getDropPosition(e: DragEvent, el: HTMLElement): "before" | "inside" | "after" {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const h = rect.height;
  if (y < h * 0.25) return "before";
  if (y > h * 0.75) return "after";
  return "inside";
}

function canDropInside(dragId: string, targetTodo: Todo): boolean {
  // ターゲットが子タスクなら、中にドロップ不可（3階層になる）
  if (targetTodo.parent_id) return false;
  // ドラッグ元が子持ちなら、中にドロップ不可（3階層になる）
  const dragChildren = childrenMap.value.get(dragId) || [];
  if (dragChildren.length > 0) return false;
  // 自分自身にはドロップ不可
  if (dragId === targetTodo.id) return false;
  return true;
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
    await addTodo({ title, parent_id: todo.id, project_id: todo.project_id });
    childTitle.value = "";
    addingChild.value = false;
    expanded.value = true;
  };

  // D&D handlers
  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation();
    dragState.value = { dragId: todo.id, dropTarget: null };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", todo.id);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { dragId } = dragState.value;
    if (!dragId || dragId === todo.id) return;

    const el = (e.currentTarget as HTMLElement);
    let position = getDropPosition(e, el);

    // inside判定時に2階層制限チェック
    if (position === "inside" && !canDropInside(dragId, todo)) {
      position = "before";
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }

    dragState.value = { dragId, dropTarget: { id: todo.id, position } };
  };

  const handleDragLeave = (e: DragEvent) => {
    e.stopPropagation();
    const { dragId } = dragState.value;
    if (dragId) {
      dragState.value = { dragId, dropTarget: null };
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { dragId, dropTarget } = dragState.value;
    if (!dragId || !dropTarget) return;

    executeDrop(dragId, dropTarget.id, dropTarget.position);
    dragState.value = { dragId: null, dropTarget: null };
  };

  const handleDragEnd = () => {
    dragState.value = { dragId: null, dropTarget: null };
  };

  const priorityClass = `badge badge-${todo.priority}`;
  const priorityLabel = { high: "高", medium: "中", low: "低" }[todo.priority];
  const children = childrenMap.value.get(todo.id) || [];
  const progress = taskProgress.value.get(todo.id);
  const isChild = !!todo.parent_id;

  // D&D visual state
  const ds = dragState.value;
  const isDragging = ds.dragId === todo.id;
  const dropPos = ds.dropTarget?.id === todo.id ? ds.dropTarget.position : null;

  let itemClass = `todo-item ${todo.status === "completed" ? "completed" : ""}`;
  if (isDragging) itemClass += " dragging";
  if (dropPos === "before") itemClass += " drag-over-before";
  if (dropPos === "after") itemClass += " drag-over-after";
  if (dropPos === "inside") itemClass += " drag-over-inside";

  return (
    <div>
      <div
        class={itemClass}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
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

function executeDrop(dragId: string, targetId: string, position: "before" | "inside" | "after") {
  const allTodos = todos.value;
  const dragTodo = allTodos.find((t) => t.id === dragId);
  const targetTodo = allTodos.find((t) => t.id === targetId);
  if (!dragTodo || !targetTodo) return;

  if (position === "inside") {
    // タスクをターゲットの子にする
    const existingChildren = childrenMap.value.get(targetId) || [];
    const maxOrder = existingChildren.reduce((max, c) => Math.max(max, c.sort_order), -1);
    reorderTodosAction([{ id: dragId, sort_order: maxOrder + 1, parent_id: targetId }]);
    return;
  }

  // before/after: 同一階層内での並び替え
  const targetParentId = targetTodo.parent_id;

  // ドラッグ元を同じ親の下に移動
  const siblings = targetParentId
    ? (childrenMap.value.get(targetParentId) || []).filter((t) => t.id !== dragId)
    : parentTodos.value.filter((t) => t.id !== dragId);

  const targetIdx = siblings.findIndex((t) => t.id === targetId);
  const insertIdx = position === "before" ? targetIdx : targetIdx + 1;

  const reordered = [...siblings];
  reordered.splice(insertIdx, 0, dragTodo);

  const items = reordered.map((t, i) => ({
    id: t.id,
    sort_order: i,
    ...(t.id === dragId ? { parent_id: targetParentId } : {}),
  }));

  reorderTodosAction(items);
}
