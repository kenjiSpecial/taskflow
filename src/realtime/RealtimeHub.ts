import type { AppEnv } from "../types";
import {
  realtimeInvalidationEventSchema,
  type RealtimeInvalidationEvent,
} from "./publish";

export class RealtimeHub implements DurableObject {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: AppEnv["Bindings"],
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/publish") {
      const secret = request.headers.get("X-Realtime-Internal-Secret");
      if (secret !== this.env.REALTIME_INTERNAL_SECRET) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const body = await request.json().catch(() => null);
      const parsed = realtimeInvalidationEventSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });
      }

      const event = parsed.data;
      this.broadcast(event);
      return Response.json({ ok: true });
    }

    if (request.method === "GET" && request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "ready", occurred_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") }));
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not Found", { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    if (text === "ping") {
      ws.send(JSON.stringify({ type: "pong", occurred_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") }));
    }
  }

  webSocketClose(): void | Promise<void> {
    // no-op: Durable Object manages socket lifecycle
  }

  webSocketError(): void | Promise<void> {
    // no-op: failed sockets are discarded by the runtime
  }

  private broadcast(event: RealtimeInvalidationEvent) {
    const payload = JSON.stringify(event);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch (error) {
        console.error("Failed to broadcast realtime event", error);
      }
    }
  }
}
