import { Hono } from "hono";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const id = c.env.REALTIME_HUB.idFromName("global");
  const stub = c.env.REALTIME_HUB.get(id);
  return stub.fetch(c.req.raw);
});

export default app;
