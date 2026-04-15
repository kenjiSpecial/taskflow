import { z } from "zod";

export const upsertWorkspaceSchema = z.object({
  zellij_session: z.string().max(200).nullable().optional(),
});

export const createWorkspacePathSchema = z.object({
  path: z.string().min(1).max(500),
  source: z.enum(["ai", "human"]),
});
