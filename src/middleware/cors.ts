import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = [
      "http://localhost:5173",
      "https://taskflow-ui.pages.dev",
    ];
    if (origin.endsWith(".taskflow-ui.pages.dev")) return origin;
    return allowed.includes(origin) ? origin : "";
  },
  allowMethods: ["GET", "POST", "PATCH", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
});
