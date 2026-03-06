import { env } from "cloudflare:test";

export async function applyMigrations() {
  // Projects
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS projects (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "name TEXT NOT NULL CHECK(length(name) <= 100)," +
    "description TEXT CHECK(length(description) <= 2000)," +
    "color TEXT CHECK(length(color) <= 7)," +
    "directory_path TEXT CHECK(length(directory_path) <= 500)," +
    "archived_at TEXT," +
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "deleted_at TEXT);"
  );
  await env.DB.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects(name) WHERE deleted_at IS NULL;");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);");

  // Todos
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS todos (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "title TEXT NOT NULL CHECK(length(title) <= 200)," +
    "description TEXT CHECK(length(description) <= 2000)," +
    "status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed'))," +
    "priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low'))," +
    "due_date TEXT," +
    "project TEXT," +
    "project_id TEXT REFERENCES projects(id) ON DELETE SET NULL," +
    "parent_id TEXT REFERENCES todos(id) ON DELETE SET NULL," +
    "sort_order INTEGER NOT NULL DEFAULT 0," +
    "completed_at TEXT," +
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "deleted_at TEXT);"
  );
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_project ON todos(project);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_project_id ON todos(project_id);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_deleted_at ON todos(deleted_at);");

  // Work Sessions
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS work_sessions (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "title TEXT NOT NULL CHECK(length(title) <= 200)," +
    "description TEXT CHECK(length(description) <= 2000)," +
    "project TEXT CHECK(length(project) <= 100)," +
    "project_id TEXT REFERENCES projects(id) ON DELETE SET NULL," +
    "status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'done'))," +
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "deleted_at TEXT);"
  );
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_work_sessions_project ON work_sessions(project);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_work_sessions_project_id ON work_sessions(project_id);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_work_sessions_deleted_at ON work_sessions(deleted_at);");

  // Session Logs
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS session_logs (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "session_id TEXT NOT NULL REFERENCES work_sessions(id)," +
    "content TEXT NOT NULL CHECK(length(content) <= 10000)," +
    "source TEXT NOT NULL DEFAULT 'ui' CHECK(source IN ('ui', 'cli'))," +
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')));"
  );
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at);");

  // Session Tasks
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS session_tasks (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "session_id TEXT NOT NULL REFERENCES work_sessions(id)," +
    "todo_id TEXT NOT NULL REFERENCES todos(id)," +
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "UNIQUE(session_id, todo_id));"
  );
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_session_tasks_session_id ON session_tasks(session_id);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_session_tasks_todo_id ON session_tasks(todo_id);");

  // Tags
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS tags (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "name TEXT NOT NULL CHECK(length(name) <= 50)," +
    "color TEXT CHECK(length(color) <= 7)," +
    "is_preset INTEGER NOT NULL DEFAULT 0," +
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "deleted_at TEXT);"
  );
  await env.DB.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name) WHERE deleted_at IS NULL;");

  // Preset tags
  await env.DB.exec("INSERT OR IGNORE INTO tags (name, color, is_preset) VALUES ('仕事', '#3B82F6', 1);");
  await env.DB.exec("INSERT OR IGNORE INTO tags (name, color, is_preset) VALUES ('プライベート', '#10B981', 1);");
  await env.DB.exec("INSERT OR IGNORE INTO tags (name, color, is_preset) VALUES ('学習', '#F59E0B', 1);");
  await env.DB.exec("INSERT OR IGNORE INTO tags (name, color, is_preset) VALUES ('副業', '#8B5CF6', 1);");

  // Project Tags
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS project_tags (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "project_id TEXT NOT NULL REFERENCES projects(id)," +
    "tag_id TEXT NOT NULL REFERENCES tags(id)," +
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "UNIQUE(project_id, tag_id));"
  );
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_project_tags_project ON project_tags(project_id);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_project_tags_tag ON project_tags(tag_id);");

  // Todo Tags
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS todo_tags (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "todo_id TEXT NOT NULL REFERENCES todos(id)," +
    "tag_id TEXT NOT NULL REFERENCES tags(id)," +
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))," +
    "UNIQUE(todo_id, tag_id));"
  );
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todo_tags_todo ON todo_tags(todo_id);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todo_tags_tag ON todo_tags(tag_id);");
}
