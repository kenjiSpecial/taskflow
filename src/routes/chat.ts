import { Hono } from "hono";
import type { AppEnv } from "../types";
import type { ChatConversationRow, ChatMessageRow } from "../lib/db";
import { now } from "../lib/db";
import {
  createConversationSchema,
  listConversationsQuery,
  createMessageSchema,
  listMessagesQuery,
} from "../validators/chat";

const app = new Hono<AppEnv>();

// GET /api/chat/conversations - 会話一覧
app.get("/conversations", async (c) => {
  const parsed = listConversationsQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: parsed.error.flatten() } }, 400);
  }

  const { limit, offset } = parsed.data;

  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM chat_conversations WHERE deleted_at IS NULL",
  ).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    "SELECT * FROM chat_conversations WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?",
  ).bind(limit, offset).all<ChatConversationRow>();

  return c.json({
    conversations: rows.results,
    meta: { total: countResult?.total ?? 0, limit, offset },
  });
});

// GET /api/chat/conversations/:id - 会話詳細
app.get("/conversations/:id", async (c) => {
  const id = c.req.param("id");
  const conversation = await c.env.DB.prepare(
    "SELECT * FROM chat_conversations WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<ChatConversationRow>();

  if (!conversation) {
    return c.json({ error: { code: "NOT_FOUND", message: "Conversation not found" } }, 404);
  }

  return c.json({ conversation });
});

// POST /api/chat/conversations - 会話作成
app.post("/conversations", async (c) => {
  const body = await c.req.json();
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const id = crypto.randomUUID().replace(/-/g, "");
  const timestamp = now();

  const conversation = await c.env.DB.prepare(
    `INSERT INTO chat_conversations (id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
  ).bind(id, data.title ?? null, timestamp, timestamp).first<ChatConversationRow>();

  return c.json({ conversation }, 201);
});

// PATCH /api/chat/conversations/:id - 会話更新
app.patch("/conversations/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT * FROM chat_conversations WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<ChatConversationRow>();

  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Conversation not found" } }, 404);
  }

  const body = await c.req.json();
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const timestamp = now();

  const conversation = await c.env.DB.prepare(
    "UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ? RETURNING *",
  ).bind(data.title ?? existing.title, timestamp, id).first<ChatConversationRow>();

  return c.json({ conversation });
});

// DELETE /api/chat/conversations/:id - 会話削除（論理削除）
app.delete("/conversations/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT * FROM chat_conversations WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<ChatConversationRow>();

  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Conversation not found" } }, 404);
  }

  const timestamp = now();
  await c.env.DB.prepare(
    "UPDATE chat_conversations SET deleted_at = ?, updated_at = ? WHERE id = ?",
  ).bind(timestamp, timestamp, id).run();

  return c.json({ success: true });
});

// GET /api/chat/conversations/:id/messages - メッセージ一覧
app.get("/conversations/:id/messages", async (c) => {
  const id = c.req.param("id");
  const conversation = await c.env.DB.prepare(
    "SELECT * FROM chat_conversations WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<ChatConversationRow>();

  if (!conversation) {
    return c.json({ error: { code: "NOT_FOUND", message: "Conversation not found" } }, 404);
  }

  const parsed = listMessagesQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: parsed.error.flatten() } }, 400);
  }

  const { order, limit, offset } = parsed.data;

  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM chat_messages WHERE conversation_id = ?",
  ).bind(id).first<{ total: number }>();

  const messages = await c.env.DB.prepare(
    `SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ${order.toUpperCase()} LIMIT ? OFFSET ?`,
  ).bind(id, limit, offset).all<ChatMessageRow>();

  return c.json({
    messages: messages.results,
    meta: { total: countResult?.total ?? 0, limit, offset },
  });
});

// POST /api/chat/conversations/:id/messages - メッセージ追加
app.post("/conversations/:id/messages", async (c) => {
  const id = c.req.param("id");
  const conversation = await c.env.DB.prepare(
    "SELECT * FROM chat_conversations WHERE id = ? AND deleted_at IS NULL",
  ).bind(id).first<ChatConversationRow>();

  if (!conversation) {
    return c.json({ error: { code: "NOT_FOUND", message: "Conversation not found" } }, 404);
  }

  const body = await c.req.json();
  const parsed = createMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const msgId = crypto.randomUUID().replace(/-/g, "");
  const timestamp = now();

  const [msgResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO chat_messages (id, conversation_id, role, content, tool_calls, tool_call_id, tool_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    ).bind(
      msgId,
      id,
      data.role,
      data.content ?? null,
      data.tool_calls ?? null,
      data.tool_call_id ?? null,
      data.tool_name ?? null,
      timestamp,
    ),
    c.env.DB.prepare(
      "UPDATE chat_conversations SET updated_at = ? WHERE id = ?",
    ).bind(timestamp, id),
  ]);

  const message = msgResult.results[0] as ChatMessageRow;

  return c.json({ message }, 201);
});

export default app;
