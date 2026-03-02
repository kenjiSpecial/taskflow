import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  directory_path: z.string().max(500).optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  archived_at: z.string().nullable().optional(),
});

export const listProjectsQuery = z.object({
  include_archived: z.enum(["true", "false"]).optional(),
});
