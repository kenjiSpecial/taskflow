import { env } from "cloudflare:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export async function applyMigrations() {
  const migrationFiles = [
    "0001_create_todos.sql",
    "0002_create_work_sessions.sql",
    "0003_add_parent_id_sort_order.sql",
    "0004_create_projects.sql",
    "0005_create_tags.sql",
    "0006_add_project_directory_path.sql",
    "0007_create_chat.sql",
    "0008_update_todo_status.sql",
    "0009_create_todo_logs_and_update_source.sql",
    "0010_add_ready_for_code_status.sql",
    "0011_add_ready_for_publish_status.sql",
    "0012_add_waiting_status.sql",
  ];

  for (const file of migrationFiles) {
    const filePath = resolve(__dirname, `../migrations/${file}`);
    try {
      const sql = readFileSync(filePath, "utf-8");
      const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await env.DB.prepare(stmt).run();
      }
    } catch {
      // Migration file may not exist, skip
    }
  }
}
