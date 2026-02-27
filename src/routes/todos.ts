import { Hono } from "hono";
import type { AppEnv } from "../types";
import type { TodoRow } from "../lib/db";
import { now } from "../lib/db";
import { createTodoSchema, updateTodoSchema, listTodosQuery } from "../validators/todo";

const app = new Hono<AppEnv>();

// GET /api/todos - 一覧
app.get("/", async (c) => {
  const parsed = listTodosQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: parsed.error.flatten() } }, 400);
  }

  const { status, priority, project, sort, order, limit, offset } = parsed.data;
  const conditions: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (priority) {
    conditions.push("priority = ?");
    params.push(priority);
  }
  if (project) {
    conditions.push("project = ?");
    params.push(project);
  }

  const where = conditions.join(" AND ");

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM todos WHERE ${where}`).bind(...params).first<{ total: number }>();

  const sortCol = sort === "priority"
    ? "CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END"
    : sort;

  const rows = await c.env.DB.prepare(
    `SELECT * FROM todos WHERE ${where} ORDER BY ${sortCol} ${order.toUpperCase()} LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all<TodoRow>();

  return c.json({
    todos: rows.results,
    meta: { total: countResult?.total ?? 0, limit, offset },
  });
});

// GET /api/todos/today - 今日のTODO
app.get("/today", async (c) => {
  const timezone = c.req.query("timezone") || "UTC";
  const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }))
    .toISOString().slice(0, 10);

  const rows = await c.env.DB.prepare(
    `SELECT * FROM todos
     WHERE deleted_at IS NULL
       AND status != 'completed'
       AND (due_date <= ? OR due_date IS NULL)
     ORDER BY
       CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
       due_date ASC NULLS LAST,
       sort_order ASC`,
  ).bind(todayStr).all<TodoRow>();

  return c.json({ todos: rows.results });
});

// GET /api/todos/:id - 詳細
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const todo = await c.env.DB.prepare(
    "SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<TodoRow>();

  if (!todo) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  const children = await c.env.DB.prepare(
    "SELECT * FROM todos WHERE parent_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC",
  ).bind(id).all<TodoRow>();

  return c.json({ todo: { ...todo, children: children.results } });
});

// POST /api/todos - 作成
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createTodoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;

  // 親タスクの階層チェック（2階層まで）
  if (data.parent_id) {
    const parent = await c.env.DB.prepare(
      "SELECT parent_id FROM todos WHERE id = ? AND deleted_at IS NULL",
    ).bind(data.parent_id).first<{ parent_id: string | null }>();

    if (!parent) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Parent todo not found" } }, 400);
    }
    if (parent.parent_id) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot create subtask of a subtask (max 2 levels)" } }, 400);
    }
  }

  const id = crypto.randomUUID().replace(/-/g, "");
  const timestamp = now();

  const todo = await c.env.DB.prepare(
    `INSERT INTO todos (id, title, description, status, priority, due_date, project, parent_id, sort_order, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  ).bind(
    id,
    data.title,
    data.description ?? null,
    data.status,
    data.priority,
    data.due_date ?? null,
    data.project ?? null,
    data.parent_id ?? null,
    data.sort_order,
    data.status === "completed" ? timestamp : null,
    timestamp,
    timestamp,
  ).first<TodoRow>();

  return c.json({ todo }, 201);
});

// PATCH /api/todos/:id - 更新
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<TodoRow>();

  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  const body = await c.req.json();
  const parsed = updateTodoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const timestamp = now();

  // completed_at の自動管理
  let completedAt = existing.completed_at;
  if (data.status === "completed" && existing.status !== "completed") {
    completedAt = timestamp;
  } else if (data.status && data.status !== "completed") {
    completedAt = null;
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  const fields = ["title", "description", "status", "priority", "due_date", "project", "parent_id", "sort_order"] as const;
  for (const field of fields) {
    if (data[field] !== undefined) {
      sets.push(`${field} = ?`);
      params.push(data[field] ?? null);
    }
  }

  sets.push("completed_at = ?", "updated_at = ?");
  params.push(completedAt, timestamp, id);

  const todo = await c.env.DB.prepare(
    `UPDATE todos SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
  ).bind(...params).first<TodoRow>();

  return c.json({ todo });
});

// DELETE /api/todos/:id - 論理削除
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<TodoRow>();

  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  const timestamp = now();

  // 親タスクの場合、子タスクも論理削除
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(timestamp, timestamp, id),
    c.env.DB.prepare("UPDATE todos SET deleted_at = ?, updated_at = ? WHERE parent_id = ? AND deleted_at IS NULL").bind(timestamp, timestamp, id),
  ]);

  return c.json({ success: true });
});

export default app;
