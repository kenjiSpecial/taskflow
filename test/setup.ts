import { env } from "cloudflare:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export async function applyMigrations() {
  const sql = readFileSync(resolve(__dirname, "../migrations/0001_create_todos.sql"), "utf-8");
  const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
}
