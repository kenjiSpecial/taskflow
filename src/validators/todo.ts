import { z } from "zod";

export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).default("backlog"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  project: z.string().max(100).optional(),
  project_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const updateTodoSchema = createTodoSchema.partial();

export const reorderTodosSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    sort_order: z.number().int().min(0),
    parent_id: z.string().nullable().optional(),
  })).min(1).max(100),
});

export const listTodosQuery = z.object({
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  project: z.string().optional(),
  project_id: z.string().optional(),
  sort: z.enum(["due_date", "priority", "created_at", "sort_order"]).default("sort_order"),
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
