import { parentTodos, loading, error } from "../stores/todo-store";
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

  return (
    <div class="todo-list">
      {parentTodos.value.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}
