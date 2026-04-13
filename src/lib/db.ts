export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  directory_path: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TodoRow {
  id: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in_progress" | "review" | "done";
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
}

export interface WorkSessionRow {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  project_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SessionLogRow {
  id: string;
  session_id: string;
  content: string;
  source: "human" | "ai";
  created_at: string;
}

export interface TodoLogRow {
  id: string;
  todo_id: string;
  content: string;
  source: "human" | "ai";
  created_at: string;
}

export interface SessionTaskRow {
  id: string;
  session_id: string;
  todo_id: string;
  created_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  color: string | null;
  is_preset: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectTagRow {
  id: string;
  project_id: string;
  tag_id: string;
  created_at: string;
}

export interface TodoTagRow {
  id: string;
  todo_id: string;
  tag_id: string;
  created_at: string;
}

export interface ChatConversationRow {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: string;
}

export function now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function projectExists(db: D1Database, projectId: string): Promise<boolean> {
  const row = await db.prepare(
    "SELECT 1 FROM projects WHERE id = ? AND deleted_at IS NULL",
  ).bind(projectId).first();
  return row !== null;
}

export async function tagExists(db: D1Database, tagId: string): Promise<boolean> {
  const row = await db.prepare(
    "SELECT 1 FROM tags WHERE id = ? AND deleted_at IS NULL",
  ).bind(tagId).first();
  return row !== null;
}
