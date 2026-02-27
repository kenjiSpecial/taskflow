import { signal, computed } from "@preact/signals";
import type { Todo, ProjectItem, CreateTodoInput, UpdateTodoInput } from "../lib/api";
import * as api from "../lib/api";

export const todos = signal<Todo[]>([]);
export const projects = signal<ProjectItem[]>([]);
export const loading = signal(false);
export const error = signal<string | null>(null);

export const filter = signal<{
  status?: string;
  priority?: string;
  project?: string;
}>({});

export const filteredTodos = computed(() => {
  return todos.value.filter((todo) => {
    if (filter.value.status && todo.status !== filter.value.status) return false;
    if (filter.value.priority && todo.priority !== filter.value.priority) return false;
    if (filter.value.project && todo.project !== filter.value.project) return false;
    return true;
  });
});

export const parentTodos = computed(() =>
  filteredTodos.value.filter((t) => !t.parent_id),
);

export const childrenMap = computed(() => {
  const map = new Map<string, Todo[]>();
  for (const todo of todos.value) {
    if (todo.parent_id) {
      const siblings = map.get(todo.parent_id) || [];
      siblings.push(todo);
      map.set(todo.parent_id, siblings);
    }
  }
  return map;
});

export const activeCount = computed(
  () => todos.value.filter((t) => t.status !== "completed").length,
);

export async function loadTodos() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.fetchTodos({ limit: "1000" });
    todos.value = res.todos;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

export async function loadProjects() {
  try {
    const res = await api.fetchProjects();
    projects.value = res.projects;
  } catch (e) {
    console.error("Failed to load projects:", e);
  }
}

export async function addTodo(data: CreateTodoInput) {
  const res = await api.createTodo(data);
  todos.value = [res.todo, ...todos.value];
  loadProjects();
  return res.todo;
}

export async function editTodo(id: string, data: UpdateTodoInput) {
  const res = await api.updateTodo(id, data);
  todos.value = todos.value.map((t) => (t.id === id ? res.todo : t));
}

export async function removeTodo(id: string) {
  await api.deleteTodo(id);
  todos.value = todos.value.filter((t) => t.id !== id && t.parent_id !== id);
  loadProjects();
}
