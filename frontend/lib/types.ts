// --- Tags ---

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateTagInput = Pick<Tag, "name"> & Partial<Pick<Tag, "color">>;
export type UpdateTagInput = Partial<Pick<Tag, "name" | "color">>;

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
  tags: Tag[];
}

export type CreateProjectInput = Pick<Project, "name"> &
  Partial<Pick<Project, "description" | "color">>;

export type UpdateProjectInput = Partial<
  Pick<Project, "name" | "description" | "color" | "archived_at">
>;

// --- Todos ---

export type TodoStatus = "backlog" | "todo" | "ready_for_code" | "in_progress" | "review" | "waiting" | "ready_for_publish" | "done";

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: "high" | "medium" | "low";
  due_date: string | null;
  project: string | null;
  project_id: string | null;
  parent_id: string | null;
  sort_order: number;
  done_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  children?: Todo[];
  tags?: { id: string; name: string; color: string | null; is_preset: boolean }[];
}

export interface TodoListResponse {
  todos: Todo[];
  meta: { total: number; limit: number; offset: number };
}

export type CreateTodoInput = Pick<Todo, "title"> &
  Partial<
    Pick<
      Todo,
      | "description"
      | "priority"
      | "due_date"
      | "project"
      | "project_id"
      | "parent_id"
      | "sort_order"
    >
  >;

export type UpdateTodoInput = Partial<
  Pick<
    Todo,
    | "title"
    | "description"
    | "status"
    | "priority"
    | "due_date"
    | "project"
    | "project_id"
    | "parent_id"
    | "sort_order"
    | "done_at"
  >
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
  source: "human" | "ai";
  created_at: string;
}

export interface TodoLog {
  id: string;
  todo_id: string;
  content: string;
  source: "human" | "ai";
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

// --- Chat ---

export interface ChatConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: string;
}

export interface CreateChatMessageInput {
  role: "user" | "assistant" | "system" | "tool";
  content?: string | null;
  tool_calls?: string | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
}

// --- Shared ---

export interface ReorderItem {
  id: string;
  sort_order: number;
  parent_id?: string | null;
}

// --- Workspace ---

export interface WorkspacePath {
  id: string;
  workspace_id: string;
  path: string;
  source: "ai" | "human";
  created_at: string;
}

export interface Workspace {
  id: string;
  todo_id: string;
  zellij_session: string | null;
  paths: WorkspacePath[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type UpsertWorkspaceInput = {
  zellij_session?: string | null;
};

export type CreateWorkspacePathInput = {
  path: string;
  source: "ai" | "human";
};
