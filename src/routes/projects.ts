import { Hono } from "hono";
import type { AppEnv } from "../types";
import { createProjectSchema, updateProjectSchema, listProjectsQuery } from "../validators/project";
import type { ProjectRow } from "../lib/db";
import { now } from "../lib/db";

const app = new Hono<AppEnv>();

interface ProjectWithCounts extends ProjectRow {
  todo_count: number;
  session_active_count: number;
  session_paused_count: number;
  session_done_count: number;
}

// GET /api/projects - プロジェクト一覧（集計付き）
app.get("/", async (c) => {
  const query = listProjectsQuery.parse(c.req.query());
  const includeArchived = query.include_archived === "true";

  const archivedFilter = includeArchived ? "" : "AND p.archived_at IS NULL";

  const rows = await c.env.DB.prepare(
    `SELECT
       p.*,
       COALESCE(tc.todo_count, 0) as todo_count,
       COALESCE(sc.session_active_count, 0) as session_active_count,
       COALESCE(sc.session_paused_count, 0) as session_paused_count,
       COALESCE(sc.session_done_count, 0) as session_done_count
     FROM projects p
     LEFT JOIN (
       SELECT project_id, COUNT(*) as todo_count
       FROM todos WHERE deleted_at IS NULL AND status != 'completed'
       GROUP BY project_id
     ) tc ON tc.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as session_active_count,
         SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as session_paused_count,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as session_done_count
       FROM work_sessions WHERE deleted_at IS NULL
       GROUP BY project_id
     ) sc ON sc.project_id = p.id
     WHERE p.deleted_at IS NULL ${archivedFilter}
     ORDER BY p.name ASC`,
  ).all<ProjectWithCounts>();

  return c.json({ projects: rows.results });
});

// GET /api/projects/:id - プロジェクト詳細
app.get("/:id", async (c) => {
  const { id } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT
       p.*,
       COALESCE(tc.todo_count, 0) as todo_count,
       COALESCE(sc.session_active_count, 0) as session_active_count,
       COALESCE(sc.session_paused_count, 0) as session_paused_count,
       COALESCE(sc.session_done_count, 0) as session_done_count
     FROM projects p
     LEFT JOIN (
       SELECT project_id, COUNT(*) as todo_count
       FROM todos WHERE deleted_at IS NULL AND status != 'completed'
       GROUP BY project_id
     ) tc ON tc.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as session_active_count,
         SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as session_paused_count,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as session_done_count
       FROM work_sessions WHERE deleted_at IS NULL
       GROUP BY project_id
     ) sc ON sc.project_id = p.id
     WHERE p.id = ? AND p.deleted_at IS NULL`,
  ).bind(id).first<ProjectWithCounts>();

  if (!row) {
    return c.json({ error: { message: "Project not found" } }, 404);
  }

  return c.json({ project: row });
});

// POST /api/projects - プロジェクト作成
app.post("/", async (c) => {
  const body = await c.req.json();
  const data = createProjectSchema.parse(body);

  const existing = await c.env.DB.prepare(
    "SELECT id FROM projects WHERE name = ? AND deleted_at IS NULL",
  ).bind(data.name).first();

  if (existing) {
    return c.json({ error: { message: "Project name already exists" } }, 409);
  }

  const ts = now();
  const row = await c.env.DB.prepare(
    `INSERT INTO projects (name, description, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     RETURNING *`,
  ).bind(data.name, data.description ?? null, data.color ?? null, ts, ts)
    .first<ProjectRow>();

  return c.json({ project: row }, 201);
});

// PATCH /api/projects/:id - プロジェクト更新
app.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const data = updateProjectSchema.parse(body);

  const existing = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<ProjectRow>();

  if (!existing) {
    return c.json({ error: { message: "Project not found" } }, 404);
  }

  // 名前変更時の重複チェック
  if (data.name && data.name !== existing.name) {
    const dup = await c.env.DB.prepare(
      "SELECT id FROM projects WHERE name = ? AND deleted_at IS NULL AND id != ?",
    ).bind(data.name, id).first();
    if (dup) {
      return c.json({ error: { message: "Project name already exists" } }, 409);
    }
  }

  const ts = now();
  const row = await c.env.DB.prepare(
    `UPDATE projects SET
       name = ?, description = ?, color = ?, archived_at = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  ).bind(
    data.name ?? existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.color !== undefined ? data.color : existing.color,
    data.archived_at !== undefined ? data.archived_at : existing.archived_at,
    ts,
    id,
  ).first<ProjectRow>();

  return c.json({ project: row });
});

// DELETE /api/projects/:id - プロジェクト論理削除
app.delete("/:id", async (c) => {
  const { id } = c.req.param();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: { message: "Project not found" } }, 404);
  }

  const ts = now();

  // 配下リソースのproject_idをNULLに + プロジェクト論理削除
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE todos SET project_id = NULL, updated_at = ? WHERE project_id = ?").bind(ts, id),
    c.env.DB.prepare("UPDATE work_sessions SET project_id = NULL, updated_at = ? WHERE project_id = ?").bind(ts, id),
    c.env.DB.prepare("UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(ts, ts, id),
  ]);

  return c.json({ success: true });
});

export default app;
