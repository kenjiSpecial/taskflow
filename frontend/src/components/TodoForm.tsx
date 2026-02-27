import { useSignal } from "@preact/signals";
import { addTodo } from "../stores/todo-store";

export function TodoForm() {
  const title = useSignal("");
  const submitting = useSignal(false);
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const value = title.value.trim();
    if (!value || submitting.value) return;

    submitting.value = true;
    try {
      await addTodo({ title: value });
      title.value = "";
    } finally {
      submitting.value = false;
    }
  };

  return (
    <form class="form-inline" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="新しいTODOを追加..."
        value={title.value}
        onInput={(e) => (title.value = (e.target as HTMLInputElement).value)}
      />
      <button type="submit" class="btn-primary" disabled={submitting.value}>
        追加
      </button>
    </form>
  );
}
