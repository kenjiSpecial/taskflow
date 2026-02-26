import { filter } from "../stores/todo-store";

export function FilterBar() {
  const setFilter = (key: string, value: string) => {
    filter.value = { ...filter.value, [key]: value || undefined };
  };

  return (
    <div class="filter-bar">
      <select
        value={filter.value.status || ""}
        onChange={(e) => setFilter("status", (e.target as HTMLSelectElement).value)}
      >
        <option value="">全ステータス</option>
        <option value="pending">未着手</option>
        <option value="in_progress">進行中</option>
        <option value="completed">完了</option>
      </select>
      <select
        value={filter.value.priority || ""}
        onChange={(e) => setFilter("priority", (e.target as HTMLSelectElement).value)}
      >
        <option value="">全優先度</option>
        <option value="high">高</option>
        <option value="medium">中</option>
        <option value="low">低</option>
      </select>
    </div>
  );
}
