import { Hono } from "hono";
import type { AppEnv } from "../types";
import type { TagRow } from "../lib/db";
import { now } from "../lib/db";
import { createTagSchema, updateTagSchema } from "../validators/tag";

const app = new Hono<AppEnv>();

// GET /api/tags - タグ一覧
app.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT * FROM tags WHERE deleted_at IS NULL ORDER BY is_preset DESC, name ASC",
  ).all<TagRow>();

  return c.json({ tags: rows.results });
});

// POST /api/tags - タグ作成
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;

  // 重複チェック
  const existing = await c.env.DB.prepare(
    "SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL",
  ).bind(data.name).first();

  if (existing) {
    return c.json({ error: { code: "CONFLICT", message: "Tag name already exists" } }, 409);
  }

  const ts = now();
  const tag = await c.env.DB.prepare(
    `INSERT INTO tags (name, color, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
  ).bind(data.name, data.color ?? null, ts, ts).first<TagRow>();

  return c.json({ tag }, 201);
});

// PATCH /api/tags/:id - タグ更新
app.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = updateTagSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;

  const existing = await c.env.DB.prepare(
    "SELECT * FROM tags WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<TagRow>();

  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);
  }

  // 名前変更時の重複チェック
  if (data.name && data.name !== existing.name) {
    const dup = await c.env.DB.prepare(
      "SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL AND id != ?",
    ).bind(data.name, id).first();
    if (dup) {
      return c.json({ error: { code: "CONFLICT", message: "Tag name already exists" } }, 409);
    }
  }

  const ts = now();
  const tag = await c.env.DB.prepare(
    `UPDATE tags SET name = ?, color = ?, updated_at = ?
     WHERE id = ?
     RETURNING *`,
  ).bind(
    data.name ?? existing.name,
    data.color !== undefined ? data.color : existing.color,
    ts,
    id,
  ).first<TagRow>();

  return c.json({ tag });
});

// DELETE /api/tags/:id - タグ論理削除 + junction物理削除
app.delete("/:id", async (c) => {
  const { id } = c.req.param();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM tags WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);
  }

  const ts = now();

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM project_tags WHERE tag_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM todo_tags WHERE tag_id = ?").bind(id),
    c.env.DB.prepare("UPDATE tags SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(ts, ts, id),
  ]);

  return c.json({ success: true });
});

export default app;
