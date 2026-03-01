import { Hono } from "hono";
import type { AppEnv } from "../types";
import type { WorkSessionRow, SessionLogRow, SessionTaskRow, TodoRow } from "../lib/db";
import { now } from "../lib/db";
import {
  createSessionSchema,
  updateSessionSchema,
  listSessionsQuery,
  createSessionLogSchema,
  listSessionLogsQuery,
  linkSessionTaskSchema,
} from "../validators/session";

const app = new Hono<AppEnv>();

// GET /api/sessions - 一覧
app.get("/", async (c) => {
  const parsed = listSessionsQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: parsed.error.flatten() } }, 400);
  }

  const { status, project, project_id, sort, order, limit, offset } = parsed.data;
  const conditions: string[] = ["ws.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (status) {
    conditions.push("ws.status = ?");
    params.push(status);
  }
  if (project_id) {
    conditions.push("ws.project_id = ?");
    params.push(project_id);
  } else if (project) {
    conditions.push("ws.project = ?");
    params.push(project);
  }

  const where = conditions.join(" AND ");

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM work_sessions ws WHERE ${where}`,
  ).bind(...params).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT ws.*, COALESCE(tp.task_total, 0) as task_total, COALESCE(tp.task_completed, 0) as task_completed
     FROM work_sessions ws
     LEFT JOIN (
       SELECT st.session_id,
         COUNT(*) as task_total,
         SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as task_completed
       FROM session_tasks st
       JOIN todos t ON st.todo_id = t.id AND t.deleted_at IS NULL
       GROUP BY st.session_id
     ) tp ON ws.id = tp.session_id
     WHERE ${where}
     ORDER BY ws.${sort} ${order.toUpperCase()} LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all<WorkSessionRow & { task_total: number; task_completed: number }>();

  return c.json({
    sessions: rows.results,
    meta: { total: countResult?.total ?? 0, limit, offset },
  });
});

// GET /api/sessions/:id - 詳細 + 最新ログ3件
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const session = await c.env.DB.prepare(
    "SELECT * FROM work_sessions WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkSessionRow>();

  if (!session) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  const logs = await c.env.DB.prepare(
    "SELECT * FROM session_logs WHERE session_id = ? ORDER BY created_at DESC LIMIT 3",
  ).bind(id).all<SessionLogRow>();

  const linkedTasks = await c.env.DB.prepare(
    `SELECT t.* FROM todos t
     JOIN session_tasks st ON st.todo_id = t.id
     WHERE st.session_id = ? AND t.deleted_at IS NULL
     ORDER BY t.created_at DESC`,
  ).bind(id).all<TodoRow>();

  return c.json({ session: { ...session, recent_logs: logs.results, linked_tasks: linkedTasks.results } });
});

// POST /api/sessions - 作成
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const id = crypto.randomUUID().replace(/-/g, "");
  const timestamp = now();

  const session = await c.env.DB.prepare(
    `INSERT INTO work_sessions (id, title, description, project, project_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  ).bind(
    id,
    data.title,
    data.description ?? null,
    data.project ?? null,
    data.project_id ?? null,
    data.status,
    timestamp,
    timestamp,
  ).first<WorkSessionRow>();

  return c.json({ session }, 201);
});

// PATCH /api/sessions/:id - 更新
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT * FROM work_sessions WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkSessionRow>();

  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  const body = await c.req.json();
  const parsed = updateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const timestamp = now();

  const sets: string[] = [];
  const params: unknown[] = [];

  const fields = ["title", "description", "project", "project_id", "status"] as const;
  for (const field of fields) {
    if (data[field] !== undefined) {
      sets.push(`${field} = ?`);
      params.push(data[field] ?? null);
    }
  }

  sets.push("updated_at = ?");
  params.push(timestamp, id);

  const session = await c.env.DB.prepare(
    `UPDATE work_sessions SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
  ).bind(...params).first<WorkSessionRow>();

  return c.json({ session });
});

// DELETE /api/sessions/:id - 論理削除
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT * FROM work_sessions WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkSessionRow>();

  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  const timestamp = now();
  await c.env.DB.prepare(
    "UPDATE work_sessions SET deleted_at = ?, updated_at = ? WHERE id = ?",
  ).bind(timestamp, timestamp, id).run();

  return c.json({ success: true });
});

// GET /api/sessions/:id/tasks - リンク済みタスク一覧
app.get("/:id/tasks", async (c) => {
  const id = c.req.param("id");
  const session = await c.env.DB.prepare(
    "SELECT * FROM work_sessions WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkSessionRow>();

  if (!session) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  const tasks = await c.env.DB.prepare(
    `SELECT t.* FROM todos t
     JOIN session_tasks st ON st.todo_id = t.id
     WHERE st.session_id = ? AND t.deleted_at IS NULL
     ORDER BY t.created_at DESC`,
  ).bind(id).all<TodoRow>();

  return c.json({ tasks: tasks.results });
});

// POST /api/sessions/:id/tasks - タスク紐付け
app.post("/:id/tasks", async (c) => {
  const id = c.req.param("id");
  const session = await c.env.DB.prepare(
    "SELECT * FROM work_sessions WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkSessionRow>();

  if (!session) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  if (session.status === "done") {
    return c.json({ error: { code: "FORBIDDEN", message: "Cannot link tasks to a completed session" } }, 403);
  }

  const body = await c.req.json();
  const parsed = linkSessionTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const { todo_id } = parsed.data;

  const todo = await c.env.DB.prepare(
    "SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(todo_id).first<TodoRow>();

  if (!todo) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  const existing = await c.env.DB.prepare(
    "SELECT * FROM session_tasks WHERE session_id = ? AND todo_id = ?",
  ).bind(id, todo_id).first<SessionTaskRow>();

  if (existing) {
    return c.json({ error: { code: "ALREADY_LINKED", message: "Task is already linked to this session" } }, 409);
  }

  const linkId = crypto.randomUUID().replace(/-/g, "");
  const timestamp = now();

  const [result] = await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO session_tasks (id, session_id, todo_id, created_at) VALUES (?, ?, ?, ?) RETURNING *",
    ).bind(linkId, id, todo_id, timestamp),
    c.env.DB.prepare(
      "UPDATE work_sessions SET updated_at = ? WHERE id = ?",
    ).bind(timestamp, id),
  ]);

  const sessionTask = result.results[0] as SessionTaskRow;
  return c.json({ session_task: sessionTask }, 201);
});

// DELETE /api/sessions/:id/tasks/:todoId - タスク紐付け解除
app.delete("/:id/tasks/:todoId", async (c) => {
  const id = c.req.param("id");
  const todoId = c.req.param("todoId");

  const session = await c.env.DB.prepare(
    "SELECT * FROM work_sessions WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkSessionRow>();

  if (!session) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  const link = await c.env.DB.prepare(
    "SELECT * FROM session_tasks WHERE session_id = ? AND todo_id = ?",
  ).bind(id, todoId).first<SessionTaskRow>();

  if (!link) {
    return c.json({ error: { code: "NOT_FOUND", message: "Task link not found" } }, 404);
  }

  await c.env.DB.prepare(
    "DELETE FROM session_tasks WHERE session_id = ? AND todo_id = ?",
  ).bind(id, todoId).run();

  return c.json({ success: true });
});

// GET /api/sessions/:id/logs - ログ一覧
app.get("/:id/logs", async (c) => {
  const id = c.req.param("id");
  const session = await c.env.DB.prepare(
    "SELECT * FROM work_sessions WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkSessionRow>();

  if (!session) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  const parsed = listSessionLogsQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: parsed.error.flatten() } }, 400);
  }

  const { order, limit, offset } = parsed.data;

  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM session_logs WHERE session_id = ?",
  ).bind(id).first<{ total: number }>();

  const logs = await c.env.DB.prepare(
    `SELECT * FROM session_logs WHERE session_id = ? ORDER BY created_at ${order.toUpperCase()} LIMIT ? OFFSET ?`,
  ).bind(id, limit, offset).all<SessionLogRow>();

  return c.json({
    logs: logs.results,
    meta: { total: countResult?.total ?? 0, limit, offset },
  });
});

// POST /api/sessions/:id/logs - ログ追加
app.post("/:id/logs", async (c) => {
  const id = c.req.param("id");
  const session = await c.env.DB.prepare(
    "SELECT * FROM work_sessions WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<WorkSessionRow>();

  if (!session) {
    return c.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
  }

  if (session.status === "done") {
    return c.json({ error: { code: "FORBIDDEN", message: "Cannot add logs to a completed session" } }, 403);
  }

  const body = await c.req.json();
  const parsed = createSessionLogSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const logId = crypto.randomUUID().replace(/-/g, "");
  const timestamp = now();

  const [log] = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO session_logs (id, session_id, content, source, created_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    ).bind(logId, id, data.content, data.source, timestamp),
    c.env.DB.prepare(
      "UPDATE work_sessions SET updated_at = ? WHERE id = ?",
    ).bind(timestamp, id),
  ]);

  const logRow = log.results[0] as SessionLogRow;
  return c.json({ log: logRow }, 201);
});

export default app;
