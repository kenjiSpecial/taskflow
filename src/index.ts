import { Hono } from "hono";
import type { AppEnv } from "./types";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error";
import todos from "./routes/todos";
import projects from "./routes/projects";
import sessions from "./routes/sessions";
import tags from "./routes/tags";
import realtime from "./routes/realtime";
export { RealtimeHub } from "./realtime/RealtimeHub";

const app = new Hono<AppEnv>();

app.onError(errorHandler);
app.use("*", corsMiddleware);

// ヘルスチェック（認証不要）
app.get("/health", (c) => c.json({ status: "ok" }));

// 認証が必要なルート
app.use("/api/*", authMiddleware);
app.route("/api/realtime", realtime);
app.route("/api/todos", todos);
app.route("/api/projects", projects);
app.route("/api/sessions", sessions);
app.route("/api/tags", tags);

export default app;
