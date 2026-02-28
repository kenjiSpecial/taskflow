import { Hono } from "hono";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET /api/projects - プロジェクト一覧
app.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT
       project,
       SUM(todo_count) as todo_count,
       SUM(session_count) as session_count
     FROM (
       SELECT project, COUNT(*) as todo_count, 0 as session_count FROM todos WHERE project IS NOT NULL AND deleted_at IS NULL GROUP BY project
       UNION ALL
       SELECT project, 0 as todo_count, COUNT(*) as session_count FROM work_sessions WHERE project IS NOT NULL AND deleted_at IS NULL GROUP BY project
     ) GROUP BY project ORDER BY (SUM(todo_count) + SUM(session_count)) DESC`,
  ).all<{ project: string; todo_count: number; session_count: number }>();

  return c.json({ projects: rows.results });
});

export default app;
