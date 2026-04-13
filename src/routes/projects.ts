import { Hono } from "hono";
import type { AppEnv } from "../types";
import { createProjectSchema, updateProjectSchema, listProjectsQuery } from "../validators/project";
import { tagLinkSchema } from "../validators/tag";
import type { ProjectRow, TagRow } from "../lib/db";
import { now, tagExists } from "../lib/db";
import { getOriginClientId, publishRealtimeInvalidation } from "../realtime/publish";

const app = new Hono<AppEnv>();

interface ProjectWithCounts extends ProjectRow {
  todo_count: number;
  session_active_count: number;
  session_paused_count: number;
  session_done_count: number;
  tag_info: string | null;
}

interface ProjectResponse extends Omit<ProjectWithCounts, "tag_info"> {
  tags: { id: string; name: string; color: string | null; is_preset: boolean }[];
}

function parseTagInfo(tagInfo: string | null): { id: string; name: string; color: string | null; is_preset: boolean }[] {
  if (!tagInfo) return [];
  return tagInfo.split(",").map((entry) => {
    const [id, name, color, isPreset] = entry.split(":");
    return { id, name, color: color || null, is_preset: isPreset === "1" };
  });
}

// GET /api/projects - プロジェクト一覧（集計付き + タグ情報）
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
       COALESCE(sc.session_done_count, 0) as session_done_count,
       tg.tag_info
     FROM projects p
     LEFT JOIN (
       SELECT project_id, COUNT(*) as todo_count
       FROM todos WHERE deleted_at IS NULL AND status != 'done'
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
     LEFT JOIN (
       SELECT pt.project_id,
         GROUP_CONCAT(t.id || ':' || t.name || ':' || COALESCE(t.color, '') || ':' || t.is_preset) as tag_info
       FROM project_tags pt
       JOIN tags t ON t.id = pt.tag_id AND t.deleted_at IS NULL
       GROUP BY pt.project_id
     ) tg ON tg.project_id = p.id
     WHERE p.deleted_at IS NULL ${archivedFilter}
     ORDER BY p.name ASC`,
  ).all<ProjectWithCounts>();

  const projects: ProjectResponse[] = rows.results.map((row) => {
    const { tag_info, ...rest } = row;
    return { ...rest, tags: parseTagInfo(tag_info) };
  });

  return c.json({ projects });
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
    `INSERT INTO projects (name, description, color, directory_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`,
  ).bind(data.name, data.description ?? null, data.color ?? null, data.directory_path ?? null, ts, ts)
    .first<ProjectRow>();

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["projects"],
      reason: "project.created",
      origin_client_id: getOriginClientId(c),
      project_id: row?.id ?? null,
      entity_id: row?.id,
    }),
  );

  return c.json({ project: row }, 201);
});

// --- Tag linking routes (must be before /:id to avoid route conflicts) ---

// GET /api/projects/:id/tags - プロジェクトのタグ一覧
app.get("/:id/tags", async (c) => {
  const { id } = c.req.param();

  const project = await c.env.DB.prepare(
    "SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!project) {
    return c.json({ error: { message: "Project not found" } }, 404);
  }

  const rows = await c.env.DB.prepare(
    `SELECT t.* FROM tags t
     JOIN project_tags pt ON pt.tag_id = t.id
     WHERE pt.project_id = ? AND t.deleted_at IS NULL
     ORDER BY t.is_preset DESC, t.name ASC`,
  ).bind(id).all<TagRow>();

  return c.json({ tags: rows.results });
});

// POST /api/projects/:id/tags - タグ紐付け
app.post("/:id/tags", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = tagLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const project = await c.env.DB.prepare(
    "SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!project) {
    return c.json({ error: { message: "Project not found" } }, 404);
  }

  if (!(await tagExists(c.env.DB, parsed.data.tag_id))) {
    return c.json({ error: { message: "Tag not found" } }, 400);
  }

  // 重複チェック
  const existing = await c.env.DB.prepare(
    "SELECT id FROM project_tags WHERE project_id = ? AND tag_id = ?",
  ).bind(id, parsed.data.tag_id).first();

  if (existing) {
    return c.json({ error: { message: "Tag already linked" } }, 409);
  }

  await c.env.DB.prepare(
    "INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)",
  ).bind(id, parsed.data.tag_id).run();

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["projects"],
      reason: "project.tag_linked",
      origin_client_id: getOriginClientId(c),
      project_id: id,
      entity_id: id,
    }),
  );

  return c.json({ success: true }, 201);
});

// DELETE /api/projects/:id/tags/:tagId - タグ紐付け解除
app.delete("/:id/tags/:tagId", async (c) => {
  const { id, tagId } = c.req.param();

  const link = await c.env.DB.prepare(
    "SELECT id FROM project_tags WHERE project_id = ? AND tag_id = ?",
  ).bind(id, tagId).first();

  if (!link) {
    return c.json({ error: { message: "Tag link not found" } }, 404);
  }

  await c.env.DB.prepare(
    "DELETE FROM project_tags WHERE project_id = ? AND tag_id = ?",
  ).bind(id, tagId).run();

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["projects"],
      reason: "project.tag_unlinked",
      origin_client_id: getOriginClientId(c),
      project_id: id,
      entity_id: id,
    }),
  );

  return c.json({ success: true });
});

// --- Single resource routes ---

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
       FROM todos WHERE deleted_at IS NULL AND status != 'done'
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
       name = ?, description = ?, color = ?, directory_path = ?, archived_at = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  ).bind(
    data.name ?? existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.color !== undefined ? data.color : existing.color,
    data.directory_path !== undefined ? data.directory_path : existing.directory_path,
    data.archived_at !== undefined ? data.archived_at : existing.archived_at,
    ts,
    id,
  ).first<ProjectRow>();

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["projects"],
      reason: "project.updated",
      origin_client_id: getOriginClientId(c),
      project_id: id,
      entity_id: id,
    }),
  );

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

  // 配下リソースのproject_idをNULLに + タグ紐付け削除 + プロジェクト論理削除
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE todos SET project_id = NULL, updated_at = ? WHERE project_id = ?").bind(ts, id),
    c.env.DB.prepare("UPDATE work_sessions SET project_id = NULL, updated_at = ? WHERE project_id = ?").bind(ts, id),
    c.env.DB.prepare("DELETE FROM project_tags WHERE project_id = ?").bind(id),
    c.env.DB.prepare("UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(ts, ts, id),
  ]);

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["projects", "todos", "sessions"],
      reason: "project.deleted",
      origin_client_id: getOriginClientId(c),
      project_id: id,
      entity_id: id,
    }),
  );

  return c.json({ success: true });
});

export default app;
