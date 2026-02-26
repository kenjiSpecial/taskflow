import { Hono } from "hono";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET /api/projects - プロジェクト一覧
app.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT DISTINCT project, COUNT(*) as count FROM todos WHERE project IS NOT NULL AND deleted_at IS NULL GROUP BY project ORDER BY count DESC",
  ).all<{ project: string; count: number }>();

  return c.json({ projects: rows.results });
});

export default app;
