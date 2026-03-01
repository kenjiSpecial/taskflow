// --- Projects ---

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  todo_count: number;
  session_active_count: number;
  session_paused_count: number;
  session_done_count: number;
}

export type CreateProjectInput = Pick<Project, "name"> &
  Partial<Pick<Project, "description" | "color">>;

export type UpdateProjectInput = Partial<
  Pick<Project, "name" | "description" | "color" | "archived_at">
>;

// --- Todos ---

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
  due_date: string | null;
  project: string | null;
  project_id: string | null;
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

export type CreateTodoInput = Pick<Todo, "title"> &
  Partial<Pick<Todo, "description" | "priority" | "due_date" | "project" | "project_id" | "parent_id" | "sort_order">>;

export type UpdateTodoInput = Partial<
  Pick<Todo, "title" | "description" | "status" | "priority" | "due_date" | "project" | "project_id" | "parent_id" | "sort_order">
>;

// --- Work Sessions ---

export interface WorkSession {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  project_id: string | null;
  status: "active" | "paused" | "done";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  recent_logs?: SessionLog[];
  linked_tasks?: Todo[];
  task_total: number;
  task_completed: number;
}

export interface SessionTask {
  id: string;
  session_id: string;
  todo_id: string;
  created_at: string;
}

export interface SessionLog {
  id: string;
  session_id: string;
  content: string;
  source: "ui" | "cli";
  created_at: string;
}

export interface WorkSessionListResponse {
  sessions: WorkSession[];
  meta: { total: number; limit: number; offset: number };
}

export interface SessionLogListResponse {
  logs: SessionLog[];
  meta: { total: number; limit: number; offset: number };
}

export type CreateSessionInput = Pick<WorkSession, "title"> &
  Partial<Pick<WorkSession, "description" | "project" | "project_id" | "status">>;

export type UpdateSessionInput = Partial<
  Pick<WorkSession, "title" | "description" | "project" | "project_id" | "status">
>;

// --- Shared ---

export interface ReorderItem {
  id: string;
  sort_order: number;
  parent_id?: string | null;
}

// --- API Client ---

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

// --- Projects API ---

export async function fetchProjects(params?: Record<string, string>): Promise<{ projects: Project[] }> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/projects${query}`);
}

export async function createProject(data: CreateProjectInput): Promise<{ project: Project }> {
  return request("/api/projects", { method: "POST", body: JSON.stringify(data) });
}

export async function updateProject(id: string, data: UpdateProjectInput): Promise<{ project: Project }> {
  return request(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteProject(id: string): Promise<void> {
  await request(`/api/projects/${id}`, { method: "DELETE" });
}

// --- Todos API ---

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

export async function reorderTodos(items: ReorderItem[]): Promise<void> {
  await request("/api/todos/reorder", { method: "PATCH", body: JSON.stringify({ items }) });
}

// --- Sessions API ---

export async function fetchSessions(params?: Record<string, string>): Promise<WorkSessionListResponse> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/sessions${query}`);
}

export async function fetchSession(id: string): Promise<{ session: WorkSession }> {
  return request(`/api/sessions/${id}`);
}

export async function createSession(data: CreateSessionInput): Promise<{ session: WorkSession }> {
  return request("/api/sessions", { method: "POST", body: JSON.stringify(data) });
}

export async function updateSession(id: string, data: UpdateSessionInput): Promise<{ session: WorkSession }> {
  return request(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteSession(id: string): Promise<void> {
  await request(`/api/sessions/${id}`, { method: "DELETE" });
}

export async function fetchSessionLogs(sessionId: string, params?: Record<string, string>): Promise<SessionLogListResponse> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/sessions/${sessionId}/logs${query}`);
}

export async function createSessionLog(sessionId: string, data: { content: string; source?: string }): Promise<{ log: SessionLog }> {
  return request(`/api/sessions/${sessionId}/logs`, { method: "POST", body: JSON.stringify(data) });
}

// --- Session Tasks API ---

export async function fetchSessionTasks(sessionId: string): Promise<{ tasks: Todo[] }> {
  return request(`/api/sessions/${sessionId}/tasks`);
}

export async function linkSessionTask(sessionId: string, todoId: string): Promise<{ session_task: SessionTask }> {
  return request(`/api/sessions/${sessionId}/tasks`, { method: "POST", body: JSON.stringify({ todo_id: todoId }) });
}

export async function unlinkSessionTask(sessionId: string, todoId: string): Promise<void> {
  await request(`/api/sessions/${sessionId}/tasks/${todoId}`, { method: "DELETE" });
}

export async function fetchTodoSessions(todoId: string): Promise<{ sessions: WorkSession[] }> {
  return request(`/api/todos/${todoId}/sessions`);
}
