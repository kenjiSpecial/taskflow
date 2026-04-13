import { getClientId } from "./client-id";
import type {
  Tag,
  CreateTagInput,
  UpdateTagInput,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Todo,
  TodoListResponse,
  CreateTodoInput,
  UpdateTodoInput,
  WorkSession,
  WorkSessionListResponse,
  CreateSessionInput,
  UpdateSessionInput,
  SessionLog,
  SessionLogListResponse,
  SessionTask,
  ReorderItem,
  TodoLog,
} from "./types";

// --- API Client ---

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
      "X-Client-Id": getClientId(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: { message?: string } }).error?.message ||
        `HTTP ${res.status}`
    );
  }
  return res.json();
}

// --- Projects API ---

export async function fetchProjects(
  params?: Record<string, string>
): Promise<{ projects: Project[] }> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/projects${query}`);
}

export async function fetchProject(
  id: string
): Promise<{ project: Project }> {
  return request(`/api/projects/${id}`);
}

export async function createProject(
  data: CreateProjectInput
): Promise<{ project: Project }> {
  return request("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(
  id: string,
  data: UpdateProjectInput
): Promise<{ project: Project }> {
  return request(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await request(`/api/projects/${id}`, { method: "DELETE" });
}

// --- Todos API ---

export async function fetchTodos(
  params?: Record<string, string>
): Promise<TodoListResponse> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/todos${query}`);
}

export async function fetchTodo(id: string): Promise<{ todo: Todo }> {
  return request(`/api/todos/${id}`);
}

export async function createTodo(
  data: CreateTodoInput
): Promise<{ todo: Todo }> {
  return request("/api/todos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTodo(
  id: string,
  data: UpdateTodoInput
): Promise<{ todo: Todo }> {
  return request(`/api/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTodo(id: string): Promise<void> {
  await request(`/api/todos/${id}`, { method: "DELETE" });
}

export async function reorderTodos(items: ReorderItem[]): Promise<void> {
  await request("/api/todos/reorder", {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}

// --- Todo Logs API ---

export async function fetchTodoLogs(
  todoId: string,
  params?: Record<string, string>
): Promise<{ logs: TodoLog[]; meta: { limit: number; offset: number } }> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/todos/${todoId}/logs${query}`);
}

export async function addTodoLog(
  todoId: string,
  data: { content: string; source?: "human" | "ai" }
): Promise<{ log: TodoLog }> {
  return request(`/api/todos/${todoId}/logs`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Sessions API ---

export async function fetchSessions(
  params?: Record<string, string>
): Promise<WorkSessionListResponse> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/sessions${query}`);
}

export async function fetchSession(
  id: string
): Promise<{ session: WorkSession }> {
  return request(`/api/sessions/${id}`);
}

export async function createSession(
  data: CreateSessionInput
): Promise<{ session: WorkSession }> {
  return request("/api/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSession(
  id: string,
  data: UpdateSessionInput
): Promise<{ session: WorkSession }> {
  return request(`/api/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await request(`/api/sessions/${id}`, { method: "DELETE" });
}

export async function fetchSessionLogs(
  sessionId: string,
  params?: Record<string, string>
): Promise<SessionLogListResponse> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request(`/api/sessions/${sessionId}/logs${query}`);
}

export async function createSessionLog(
  sessionId: string,
  data: { content: string; source?: string }
): Promise<{ log: SessionLog }> {
  return request(`/api/sessions/${sessionId}/logs`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Session Tasks API ---

export async function fetchSessionTasks(
  sessionId: string
): Promise<{ tasks: Todo[] }> {
  return request(`/api/sessions/${sessionId}/tasks`);
}

export async function linkSessionTask(
  sessionId: string,
  todoId: string
): Promise<{ session_task: SessionTask }> {
  return request(`/api/sessions/${sessionId}/tasks`, {
    method: "POST",
    body: JSON.stringify({ todo_id: todoId }),
  });
}

export async function unlinkSessionTask(
  sessionId: string,
  todoId: string
): Promise<void> {
  await request(`/api/sessions/${sessionId}/tasks/${todoId}`, {
    method: "DELETE",
  });
}

export async function fetchTodoSessions(
  todoId: string
): Promise<{ sessions: WorkSession[] }> {
  return request(`/api/todos/${todoId}/sessions`);
}

// --- Tags API ---

export async function fetchTags(): Promise<{ tags: Tag[] }> {
  return request("/api/tags");
}

export async function createTag(
  data: CreateTagInput
): Promise<{ tag: Tag }> {
  return request("/api/tags", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTag(
  id: string,
  data: UpdateTagInput
): Promise<{ tag: Tag }> {
  return request(`/api/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTag(id: string): Promise<void> {
  await request(`/api/tags/${id}`, { method: "DELETE" });
}

// --- Project-Tag linking ---

export async function fetchProjectTags(
  projectId: string
): Promise<{ tags: Tag[] }> {
  return request(`/api/projects/${projectId}/tags`);
}

export async function linkProjectTag(
  projectId: string,
  tagId: string
): Promise<void> {
  await request(`/api/projects/${projectId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tag_id: tagId }),
  });
}

export async function unlinkProjectTag(
  projectId: string,
  tagId: string
): Promise<void> {
  await request(`/api/projects/${projectId}/tags/${tagId}`, {
    method: "DELETE",
  });
}

// --- Todo-Tag linking ---

export async function fetchTodoTags(
  todoId: string
): Promise<{ tags: Tag[] }> {
  return request(`/api/todos/${todoId}/tags`);
}

export async function linkTodoTag(
  todoId: string,
  tagId: string
): Promise<void> {
  await request(`/api/todos/${todoId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tag_id: tagId }),
  });
}

export async function unlinkTodoTag(
  todoId: string,
  tagId: string
): Promise<void> {
  await request(`/api/todos/${todoId}/tags/${tagId}`, { method: "DELETE" });
}
