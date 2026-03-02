import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateTagSchema = createTagSchema.partial();

export const tagLinkSchema = z.object({
  tag_id: z.string().min(1),
});
