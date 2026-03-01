import { env } from "cloudflare:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export async function applyMigrations() {
  const migrationFiles = [
    "0001_create_todos.sql",
    "0002_create_work_sessions.sql",
    "0003_add_parent_id_sort_order.sql",
    "0004_create_projects.sql",
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
