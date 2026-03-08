import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

export const listConversationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().nullable().optional(),
  tool_calls: z.string().nullable().optional(),
  tool_call_id: z.string().nullable().optional(),
  tool_name: z.string().nullable().optional(),
});

export const listMessagesQuery = z.object({
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
