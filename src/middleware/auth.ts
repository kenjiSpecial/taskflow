import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" } }, 401);
  }

  const token = header.slice(7);
  if (token !== c.env.API_TOKEN) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }, 401);
  }

  await next();
});
