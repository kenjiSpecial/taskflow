import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  project: z.string().max(100).optional(),
  project_id: z.string().nullable().optional(),
  status: z.enum(["active", "paused", "done"]).default("active"),
});

export const updateSessionSchema = createSessionSchema.partial();

export const listSessionsQuery = z.object({
  status: z.enum(["active", "paused", "done"]).optional(),
  project: z.string().optional(),
  project_id: z.string().optional(),
  sort: z.enum(["created_at", "updated_at"]).default("updated_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createSessionLogSchema = z.object({
  content: z.string().min(1).max(10000),
  source: z.enum(["ui", "cli"]).default("ui"),
});

export const linkSessionTaskSchema = z.object({
  todo_id: z.string().min(1),
});

export const listSessionLogsQuery = z.object({
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
