import { Hono } from "hono";
import type { AppEnv } from "../types";
import type { TodoRow, TodoLogRow, WorkSessionRow, TagRow } from "../lib/db";
import { now, projectExists, tagExists } from "../lib/db";
import { createTodoSchema, updateTodoSchema, listTodosQuery, reorderTodosSchema, createTodoLogSchema, listTodoLogsQuery } from "../validators/todo";
import { tagLinkSchema } from "../validators/tag";
import { getOriginClientId, publishRealtimeInvalidation } from "../realtime/publish";

const app = new Hono<AppEnv>();

interface TodoWithTags extends TodoRow {
  tag_info: string | null;
}

function parseTagInfo(tagInfo: string | null): { id: string; name: string; color: string | null; is_preset: boolean }[] {
  if (!tagInfo) return [];
  return tagInfo.split(",").map((entry) => {
    const [id, name, color, isPreset] = entry.split(":");
    return { id, name, color: color || null, is_preset: isPreset === "1" };
  });
}

// GET /api/todos - 一覧
app.get("/", async (c) => {
  const parsed = listTodosQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: parsed.error.flatten() } }, 400);
  }

  const { status, priority, project, project_id, sort, order, limit, offset } = parsed.data;
  const conditions: string[] = ["t.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (status) {
    conditions.push("t.status = ?");
    params.push(status);
  }
  if (priority) {
    conditions.push("t.priority = ?");
    params.push(priority);
  }
  if (project_id) {
    conditions.push("t.project_id = ?");
    params.push(project_id);
  } else if (project) {
    conditions.push("t.project = ?");
    params.push(project);
  }

  const where = conditions.join(" AND ");

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM todos t WHERE ${where}`).bind(...params).first<{ total: number }>();

  const sortCol = sort === "priority"
    ? "CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END"
    : `t.${sort}`;

  // sort_orderの場合、同値ではcreated_at DESCでフォールバック
  const orderBy = sort === "sort_order"
    ? `${sortCol} ${order.toUpperCase()}, t.created_at DESC`
    : `${sortCol} ${order.toUpperCase()}`;

  const rows = await c.env.DB.prepare(
    `SELECT t.*, tg.tag_info
     FROM todos t
     LEFT JOIN (
       SELECT tt.todo_id,
         GROUP_CONCAT(tg.id || ':' || tg.name || ':' || COALESCE(tg.color, '') || ':' || tg.is_preset) as tag_info
       FROM todo_tags tt
       JOIN tags tg ON tg.id = tt.tag_id AND tg.deleted_at IS NULL
       GROUP BY tt.todo_id
     ) tg ON tg.todo_id = t.id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all<TodoWithTags>();

  const todos = rows.results.map((row) => {
    const { tag_info, ...rest } = row;
    return { ...rest, tags: parseTagInfo(tag_info) };
  });

  return c.json({
    todos,
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
       AND status != 'done'
       AND (due_date <= ? OR due_date IS NULL)
     ORDER BY
       CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
       due_date ASC NULLS LAST,
       sort_order ASC`,
  ).bind(todayStr).all<TodoRow>();

  return c.json({ todos: rows.results });
});

// PATCH /api/todos/reorder - 一括並び替え
app.patch("/reorder", async (c) => {
  const body = await c.req.json();
  const parsed = reorderTodosSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const { items } = parsed.data;
  const timestamp = now();

  const stmts = items.map((item) => {
    if (item.parent_id !== undefined) {
      return c.env.DB.prepare(
        "UPDATE todos SET sort_order = ?, parent_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      ).bind(item.sort_order, item.parent_id, timestamp, item.id);
    }
    return c.env.DB.prepare(
      "UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    ).bind(item.sort_order, timestamp, item.id);
  });

  await c.env.DB.batch(stmts);

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["todos"],
      reason: "todo.reordered",
      origin_client_id: getOriginClientId(c),
    }),
  );

  return c.json({ success: true });
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

  // project_id 存在チェック
  if (data.project_id) {
    if (!(await projectExists(c.env.DB, data.project_id))) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Project not found" } }, 400);
    }
  }

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
    `INSERT INTO todos (id, title, description, status, priority, due_date, project, project_id, parent_id, sort_order, done_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  ).bind(
    id,
    data.title,
    data.description ?? null,
    data.status,
    data.priority,
    data.due_date ?? null,
    data.project ?? null,
    data.project_id ?? null,
    data.parent_id ?? null,
    data.sort_order,
    data.status === "done" ? timestamp : null,
    timestamp,
    timestamp,
  ).first<TodoRow>();

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["todos", "projects"],
      reason: "todo.created",
      origin_client_id: getOriginClientId(c),
      project_id: todo?.project_id ?? null,
      entity_id: todo?.id,
    }),
  );

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

  // project_id 存在チェック
  if (data.project_id) {
    if (!(await projectExists(c.env.DB, data.project_id))) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Project not found" } }, 400);
    }
  }

  // parent_id 変更時の階層チェック
  if (data.parent_id !== undefined && data.parent_id !== null) {
    if (data.parent_id === id) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot set self as parent" } }, 400);
    }
    const parent = await c.env.DB.prepare(
      "SELECT parent_id FROM todos WHERE id = ? AND deleted_at IS NULL",
    ).bind(data.parent_id).first<{ parent_id: string | null }>();
    if (!parent) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Parent todo not found" } }, 400);
    }
    if (parent.parent_id) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot create subtask of a subtask (max 2 levels)" } }, 400);
    }
    // 子持ちタスクを別タスクの子にしようとした場合（3階層防止）
    const hasChildren = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM todos WHERE parent_id = ? AND deleted_at IS NULL",
    ).bind(id).first<{ count: number }>();
    if (hasChildren && hasChildren.count > 0) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot nest a task that has children (max 2 levels)" } }, 400);
    }
  }

  // done_at の自動管理
  let doneAt = existing.done_at;
  if (data.status === "done" && existing.status !== "done") {
    doneAt = timestamp;
  } else if (data.status && data.status !== "done") {
    doneAt = null;
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  const fields = ["title", "description", "status", "priority", "due_date", "project", "project_id", "parent_id", "sort_order"] as const;
  for (const field of fields) {
    if (data[field] !== undefined) {
      sets.push(`${field} = ?`);
      params.push(data[field] ?? null);
    }
  }

  sets.push("done_at = ?", "updated_at = ?");
  params.push(doneAt, timestamp, id);

  const todo = await c.env.DB.prepare(
    `UPDATE todos SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
  ).bind(...params).first<TodoRow>();

  const resources = new Set<"todos" | "projects">(["todos"]);
  if (data.status !== undefined || data.project_id !== undefined) {
    resources.add("projects");
  }

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: [...resources],
      reason: "todo.updated",
      origin_client_id: getOriginClientId(c),
      project_id: todo?.project_id ?? existing.project_id ?? null,
      entity_id: id,
      ...(data.status !== undefined && data.status !== existing.status
        ? { old_status: existing.status, new_status: data.status }
        : {}),
    }),
  );

  return c.json({ todo });
});

// GET /api/todos/:id/sessions - 関連セッション一覧
app.get("/:id/sessions", async (c) => {
  const id = c.req.param("id");
  const todo = await c.env.DB.prepare(
    "SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<TodoRow>();

  if (!todo) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  const sessions = await c.env.DB.prepare(
    `SELECT ws.* FROM work_sessions ws
     JOIN session_tasks st ON st.session_id = ws.id
     WHERE st.todo_id = ? AND ws.deleted_at IS NULL
     ORDER BY ws.updated_at DESC`,
  ).bind(id).all<WorkSessionRow>();

  return c.json({ sessions: sessions.results });
});

// GET /api/todos/:id/tags - タスクのタグ一覧
app.get("/:id/tags", async (c) => {
  const id = c.req.param("id");

  const todo = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!todo) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  const rows = await c.env.DB.prepare(
    `SELECT t.* FROM tags t
     JOIN todo_tags tt ON tt.tag_id = t.id
     WHERE tt.todo_id = ? AND t.deleted_at IS NULL
     ORDER BY t.is_preset DESC, t.name ASC`,
  ).bind(id).all<TagRow>();

  return c.json({ tags: rows.results });
});

// POST /api/todos/:id/tags - タグ紐付け
app.post("/:id/tags", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = tagLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const todo = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!todo) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  if (!(await tagExists(c.env.DB, parsed.data.tag_id))) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Tag not found" } }, 400);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM todo_tags WHERE todo_id = ? AND tag_id = ?",
  ).bind(id, parsed.data.tag_id).first();

  if (existing) {
    return c.json({ error: { code: "CONFLICT", message: "Tag already linked" } }, 409);
  }

  await c.env.DB.prepare(
    "INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)",
  ).bind(id, parsed.data.tag_id).run();

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["todos"],
      reason: "todo.tag_linked",
      origin_client_id: getOriginClientId(c),
      entity_id: id,
    }),
  );

  return c.json({ success: true }, 201);
});

// DELETE /api/todos/:id/tags/:tagId - タグ紐付け解除
app.delete("/:id/tags/:tagId", async (c) => {
  const { id, tagId } = c.req.param();

  const link = await c.env.DB.prepare(
    "SELECT id FROM todo_tags WHERE todo_id = ? AND tag_id = ?",
  ).bind(id, tagId).first();

  if (!link) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tag link not found" } }, 404);
  }

  await c.env.DB.prepare(
    "DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?",
  ).bind(id, tagId).run();

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["todos"],
      reason: "todo.tag_unlinked",
      origin_client_id: getOriginClientId(c),
      entity_id: id,
    }),
  );

  return c.json({ success: true });
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

  // タグ紐付け削除 + 親タスクの場合、子タスクも論理削除
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM todo_tags WHERE todo_id = ?").bind(id),
    c.env.DB.prepare("UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(timestamp, timestamp, id),
    c.env.DB.prepare("UPDATE todos SET deleted_at = ?, updated_at = ? WHERE parent_id = ? AND deleted_at IS NULL").bind(timestamp, timestamp, id),
  ]);

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["todos", "projects"],
      reason: "todo.deleted",
      origin_client_id: getOriginClientId(c),
      project_id: existing.project_id ?? null,
      entity_id: id,
    }),
  );

  return c.json({ success: true });
});

// GET /api/todos/:id/logs - タスクログ一覧
app.get("/:id/logs", async (c) => {
  const id = c.req.param("id");
  const parsed = listTodoLogsQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: parsed.error.flatten() } }, 400);
  }

  const todo = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!todo) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  const { order, limit, offset } = parsed.data;
  const rows = await c.env.DB.prepare(
    `SELECT * FROM todo_logs WHERE todo_id = ? ORDER BY created_at ${order} LIMIT ? OFFSET ?`,
  ).bind(id, limit, offset).all<TodoLogRow>();

  return c.json({ logs: rows.results, meta: { limit, offset } });
});

// POST /api/todos/:id/logs - タスクログ追加
app.post("/:id/logs", async (c) => {
  const id = c.req.param("id");

  const todo = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first();

  if (!todo) {
    return c.json({ error: { code: "NOT_FOUND", message: "Todo not found" } }, 404);
  }

  const body = await c.req.json();
  const parsed = createTodoLogSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const logId = crypto.randomUUID().replace(/-/g, "");
  const timestamp = now();

  const [log] = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO todo_logs (id, todo_id, content, source, created_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    ).bind(logId, id, data.content, data.source, timestamp),
    c.env.DB.prepare(
      "UPDATE todos SET updated_at = ? WHERE id = ?",
    ).bind(timestamp, id),
  ]);

  c.executionCtx.waitUntil(
    publishRealtimeInvalidation(c.env, {
      resources: ["todos"],
      reason: "todo_log.created",
      origin_client_id: getOriginClientId(c),
      entity_id: id,
    }),
  );

  return c.json({ log: (log as D1Result<TodoLogRow>).results[0] }, 201);
});

export default app;
