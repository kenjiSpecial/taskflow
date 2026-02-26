import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = [
      "http://localhost:5173",
    ];
    if (origin.endsWith(".pages.dev")) return origin;
    return allowed.includes(origin) ? origin : "";
  },
  allowMethods: ["GET", "POST", "PATCH", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
});
