import { env } from "cloudflare:test";

export async function applyMigrations() {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS todos (" +
    "id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))," +
    "title TEXT NOT NULL CHECK(length(title) <= 200)," +
    "description TEXT CHECK(length(description) <= 2000)," +
    "status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed'))," +
    "priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low'))," +
    "due_date TEXT," +
    "project TEXT," +
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
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id);");
  await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_todos_deleted_at ON todos(deleted_at);");
}
