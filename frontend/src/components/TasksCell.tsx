import { useSignal } from "@preact/signals";
import type { Todo } from "../lib/api";
import { expandedTaskProjects, toggleTasksExpanded } from "../stores/app-store";
import { addTodo, childrenMap, taskProgress, toggleTodo, dragState, changeTaskProject, loadTodos } from "../stores/todo-store";
import { tags, linkTodoTag, unlinkTodoTag } from "../stores/tag-store";

interface Props {
  projectId: string | null;
  todos: Todo[];
  isArchived: boolean;
}

export function TasksCell({ projectId, todos, isArchived }: Props) {
  const adding = useSignal(false);
  const title = useSignal("");
  const dragOver = useSignal(false);

  const key = projectId ?? "_uncategorized";
  const isExpanded = expandedTaskProjects.value.has(key);

  const parentTodos = todos
    .filter((t) => !t.parent_id && t.status !== "completed")
    .sort((a, b) => a.sort_order - b.sort_order);
  const completedCount = todos.filter((t) => !t.parent_id && t.status === "completed").length;

  const handleAdd = async () => {
    const value = title.value.trim();
    if (!value) return;
    await addTodo({ title: value, project_id: projectId });
    title.value = "";
    adding.value = false;
  };

  // セル全体のドロップターゲット（別プロジェクトからのD&D）
  const handleCellDragOver = (e: DragEvent) => {
    e.preventDefault();
    const { dragId } = dragState.value;
    if (!dragId) return;
    // ドラッグ元のタスクがこのプロジェクトに属していなければドロップ可能
    const dragTodo = todos.find((t) => t.id === dragId);
    if (!dragTodo) {
      dragOver.value = true;
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    }
  };

  const handleCellDragLeave = () => {
    dragOver.value = false;
  };

  const handleCellDrop = (e: DragEvent) => {
    e.preventDefault();
    dragOver.value = false;
    const { dragId } = dragState.value;
    if (!dragId) return;
    // このセルのプロジェクトにタスクを移動
    changeTaskProject(dragId, projectId);
    dragState.value = { dragId: null, dropTarget: null };
  };

  const cellClass = `card-tasks-section${dragOver.value ? " drag-over-cell" : ""}`;

  return (
    <div
      class={cellClass}
      onDragOver={handleCellDragOver}
      onDragLeave={handleCellDragLeave}
      onDrop={handleCellDrop}
    >
      <button
        class="btn-ghost matrix-tasks-toggle"
        onClick={() => toggleTasksExpanded(key)}
      >
        <span>{isExpanded ? "▼" : "▶"}</span>
        <span>{parentTodos.length} 件</span>
        {completedCount > 0 && (
          <span class="tasks-completed-count">({completedCount} 完了)</span>
        )}
      </button>

      {isExpanded && (
        <div class="matrix-tasks-list">
          {parentTodos.map((todo) => (
            <MiniTodoItem key={todo.id} todo={todo} />
          ))}

          {!isArchived && (
            <>
              {adding.value ? (
                <div class="matrix-add-form">
                  <input
                    type="text"
                    placeholder="タスク名..."
                    value={title.value}
                    onInput={(e) => (title.value = (e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                      if (e.key === "Escape") (adding.value = false);
                    }}
                    // biome-ignore lint: autofocus is intentional
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  class="btn-ghost matrix-add-btn"
                  onClick={() => (adding.value = true)}
                >
                  + タスク追加
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MiniTodoItem({ todo }: { todo: Todo }) {
  const progress = taskProgress.value.get(todo.id);
  const isParent = !todo.parent_id;
  const tagging = useSignal(false);

  const todoTags = todo.tags ?? [];

  const handleToggle = async () => {
    await toggleTodo(todo.id, todo.status);
  };

  const handleTagToggle = async (tagId: string) => {
    const isLinked = todoTags.some((t) => t.id === tagId);
    try {
      if (isLinked) {
        await unlinkTodoTag(todo.id, tagId);
      } else {
        await linkTodoTag(todo.id, tagId);
      }
      await loadTodos();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // D&D（親タスクのみドラッグ可能）
  const handleDragStart = (e: DragEvent) => {
    if (!isParent) {
      e.preventDefault();
      return;
    }
    dragState.value = { dragId: todo.id, dropTarget: null };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", todo.id);
    }
  };

  const handleDragEnd = () => {
    dragState.value = { dragId: null, dropTarget: null };
  };

  const isDragging = dragState.value.dragId === todo.id;

  return (
    <div
      class={`mini-todo-item${isDragging ? " dragging" : ""}`}
      draggable={isParent}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <input
        type="checkbox"
        class="todo-checkbox"
        checked={todo.status === "completed"}
        onChange={handleToggle}
      />
      <div class="mini-todo-content">
        <span class="mini-todo-title">{todo.title}</span>
        {progress && progress.total > 0 && (
          <span class="todo-progress">
            {progress.completed}/{progress.total}
          </span>
        )}
      </div>
      {todoTags.length > 0 && (
        <div class="mini-todo-tags">
          {todoTags.map((tag) => (
            <span
              key={tag.id}
              class="tag-mini"
              style={tag.color ? { "--tag-color": tag.color } as Record<string, string> : undefined}
            >
              {tag.color && <span class="tag-dot" />}
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <button
        class="btn-ghost mini-todo-tag-btn"
        onClick={(e) => { e.stopPropagation(); tagging.value = !tagging.value; }}
        title="タグ"
      >
        #
      </button>
      {tagging.value && (
        <div class="mini-todo-tag-picker" onClick={(e) => e.stopPropagation()}>
          {tags.value.map((tag) => {
            const isLinked = todoTags.some((t) => t.id === tag.id);
            return (
              <button
                key={tag.id}
                class={`tag-picker-item ${isLinked ? "tag-picker-active" : ""}`}
                style={tag.color ? { "--tag-color": tag.color } as Record<string, string> : undefined}
                onClick={() => handleTagToggle(tag.id)}
              >
                {tag.color && <span class="tag-dot" />}
                {tag.name}
                {isLinked && <span class="tag-check">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
