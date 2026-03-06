import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const isWebSocket = c.req.header("Upgrade")?.toLowerCase() === "websocket";
  const queryToken = isWebSocket ? c.req.query("token") : null;
  const header = c.req.header("Authorization");
  const token = queryToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : null);

  if (!token) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Missing authentication token" } }, 401);
  }

  if (token !== c.env.API_TOKEN) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }, 401);
  }

  await next();
});
