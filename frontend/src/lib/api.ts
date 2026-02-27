export interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
  due_date: string | null;
  project: string | null;
  parent_id: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  children?: Todo[];
}

export interface TodoListResponse {
  todos: Todo[];
  meta: { total: number; limit: number; offset: number };
}

export interface ProjectItem {
  project: string;
  count: number;
}

export type CreateTodoInput = Pick<Todo, "title"> &
  Partial<Pick<Todo, "description" | "priority" | "due_date" | "project" | "parent_id" | "sort_order">>;

export type UpdateTodoInput = Partial<
  Pick<Todo, "title" | "description" | "status" | "priority" | "due_date" | "project" | "parent_id" | "sort_order">
>;

const API_BASE = import.meta.env.VITE_API_URL || "";
const API_TOKEN = import.meta.env.VITE_API_TOKEN || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchTodos(params?: Record<string, string>): Promise<TodoListResponse> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/todos${query}`);
}

export async function fetchTodo(id: string): Promise<{ todo: Todo }> {
  return request(`/api/todos/${id}`);
}

export async function createTodo(data: CreateTodoInput): Promise<{ todo: Todo }> {
  return request("/api/todos", { method: "POST", body: JSON.stringify(data) });
}

export async function updateTodo(id: string, data: UpdateTodoInput): Promise<{ todo: Todo }> {
  return request(`/api/todos/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteTodo(id: string): Promise<void> {
  await request(`/api/todos/${id}`, { method: "DELETE" });
}

export async function fetchProjects(): Promise<{ projects: ProjectItem[] }> {
  return request("/api/projects");
}
