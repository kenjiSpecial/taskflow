import type { Hono } from "hono";
import type { AppEnv } from "../types";
import type { WorkspaceRow, WorkspacePathRow } from "../lib/db";
import { now } from "../lib/db";
import { upsertWorkspaceSchema, createWorkspacePathSchema } from "../validators/workspace";

export function registerWorkspaceRoutes(app: Hono<AppEnv>) {
  // GET /api/todos/:id/workspace
  app.get("/:id/workspace", async (c) => {
    const { id } = c.req.param();

    const workspace = await c.env.DB.prepare(
      "SELECT * FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
    ).bind(id).first<WorkspaceRow>();

    if (!workspace) {
      return c.json({ error: { message: "Workspace not found" } }, 404);
    }

    const paths = await c.env.DB.prepare(
      "SELECT * FROM workspace_paths WHERE workspace_id = ? ORDER BY created_at ASC",
    ).bind(workspace.id).all<WorkspacePathRow>();

    return c.json({ workspace: { ...workspace, paths: paths.results } });
  });

  // PUT /api/todos/:id/workspace
  app.put("/:id/workspace", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const data = upsertWorkspaceSchema.parse(body);

    const todo = await c.env.DB.prepare(
      "SELECT id FROM todos WHERE id = ? AND deleted_at IS NULL",
    ).bind(id).first();

    if (!todo) {
      return c.json({ error: { message: "Todo not found" } }, 404);
    }

    const ts = now();
    // 論理削除済みを含む全レコードを検索（inline UNIQUE制約はdeleted_atに関わらず適用されるため）
    const existing = await c.env.DB.prepare(
      "SELECT * FROM workspaces WHERE todo_id = ?",
    ).bind(id).first<WorkspaceRow>();

    let workspace: WorkspaceRow | null;
    if (existing) {
      // 既存レコードをUPDATE（削除済みの場合はdeleted_atをクリアして復元）
      workspace = await c.env.DB.prepare(
        "UPDATE workspaces SET zellij_session = ?, updated_at = ?, deleted_at = NULL WHERE id = ? RETURNING *",
      ).bind(data.zellij_session ?? null, ts, existing.id).first<WorkspaceRow>();
    } else {
      workspace = await c.env.DB.prepare(
        "INSERT INTO workspaces (todo_id, zellij_session, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *",
      ).bind(id, data.zellij_session ?? null, ts, ts).first<WorkspaceRow>();
    }

    const paths = await c.env.DB.prepare(
      "SELECT * FROM workspace_paths WHERE workspace_id = ? ORDER BY created_at ASC",
    ).bind(workspace!.id).all<WorkspacePathRow>();

    return c.json({ workspace: { ...workspace, paths: paths.results } });
  });

  // DELETE /api/todos/:id/workspace
  app.delete("/:id/workspace", async (c) => {
    const { id } = c.req.param();
    const ts = now();

    const workspace = await c.env.DB.prepare(
      "SELECT id FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
    ).bind(id).first<WorkspaceRow>();

    if (!workspace) {
      return c.json({ error: { message: "Workspace not found" } }, 404);
    }

    await c.env.DB.prepare(
      "UPDATE workspaces SET deleted_at = ?, updated_at = ? WHERE id = ?",
    ).bind(ts, ts, workspace.id).run();

    return c.json({ success: true });
  });

  // POST /api/todos/:id/workspace/paths
  app.post("/:id/workspace/paths", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const data = createWorkspacePathSchema.parse(body);

    const workspace = await c.env.DB.prepare(
      "SELECT id FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
    ).bind(id).first<WorkspaceRow>();

    if (!workspace) {
      return c.json({ error: { message: "Workspace not found" } }, 404);
    }

    const dup = await c.env.DB.prepare(
      "SELECT id FROM workspace_paths WHERE workspace_id = ? AND path = ?",
    ).bind(workspace.id, data.path).first();

    if (dup) {
      return c.json({ error: { message: "Path already exists" } }, 409);
    }

    const ts = now();
    const path = await c.env.DB.prepare(
      "INSERT INTO workspace_paths (workspace_id, path, source, created_at) VALUES (?, ?, ?, ?) RETURNING *",
    ).bind(workspace.id, data.path, data.source, ts).first<WorkspacePathRow>();

    return c.json({ path }, 201);
  });

  // DELETE /api/todos/:id/workspace/paths/:pathId
  app.delete("/:id/workspace/paths/:pathId", async (c) => {
    const { id, pathId } = c.req.param();

    const workspace = await c.env.DB.prepare(
      "SELECT id FROM workspaces WHERE todo_id = ? AND deleted_at IS NULL",
    ).bind(id).first<WorkspaceRow>();

    if (!workspace) {
      return c.json({ error: { message: "Workspace not found" } }, 404);
    }

    const path = await c.env.DB.prepare(
      "SELECT id FROM workspace_paths WHERE id = ? AND workspace_id = ?",
    ).bind(pathId, workspace.id).first();

    if (!path) {
      return c.json({ error: { message: "Path not found" } }, 404);
    }

    await c.env.DB.prepare(
      "DELETE FROM workspace_paths WHERE id = ?",
    ).bind(pathId).run();

    return c.json({ success: true });
  });
}
