import { parentTodos, loading, error, dragState, reorderTodosAction, todos } from "../stores/todo-store";
import { TodoItem } from "./TodoItem";

export function TodoList() {
  if (error.value) {
    return <div class="error">{error.value}</div>;
  }

  if (loading.value) {
    return <div class="empty">読み込み中...</div>;
  }

  if (parentTodos.value.length === 0) {
    return <div class="empty">TODOがありません</div>;
  }

  const handleDropZoneDragOver = (e: DragEvent) => {
    e.preventDefault();
    const { dragId } = dragState.value;
    if (!dragId) return;
    // 子タスクをトップレベルに戻すためのゾーン
    const dragTodo = todos.value.find((t) => t.id === dragId);
    if (dragTodo?.parent_id) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDropZoneDrop = (e: DragEvent) => {
    e.preventDefault();
    const { dragId } = dragState.value;
    if (!dragId) return;
    const dragTodo = todos.value.find((t) => t.id === dragId);
    if (dragTodo?.parent_id) {
      const maxOrder = parentTodos.value.reduce((max, t) => Math.max(max, t.sort_order), -1);
      reorderTodosAction([{ id: dragId, sort_order: maxOrder + 1, parent_id: null }]);
    }
    dragState.value = { dragId: null, dropTarget: null };
  };

  const isDropZoneActive = (() => {
    const { dragId } = dragState.value;
    if (!dragId) return false;
    const dragTodo = todos.value.find((t) => t.id === dragId);
    return !!dragTodo?.parent_id;
  })();

  return (
    <div class="todo-list">
      {parentTodos.value.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
      {dragState.value.dragId && (
        <div
          class={`todo-drop-zone ${isDropZoneActive ? "active" : ""}`}
          onDragOver={handleDropZoneDragOver}
          onDrop={handleDropZoneDrop}
        />
      )}
    </div>
  );
}
