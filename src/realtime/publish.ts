import type { AppEnv } from "../types";
import { z } from "zod";

export type RealtimeResource =
  | "projects"
  | "todos"
  | "sessions"
  | "tags"
  | "session_logs"
  | "session_tasks";

export interface RealtimeInvalidationEvent {
  type: "invalidate";
  scope: "all";
  resources: RealtimeResource[];
  reason: string;
  origin_client_id?: string;
  project_id?: string | null;
  entity_id?: string;
  occurred_at: string;
}

export const realtimeResourceSchema = z.enum([
  "projects",
  "todos",
  "sessions",
  "tags",
  "session_logs",
  "session_tasks",
]);

export const realtimeInvalidationEventSchema = z.object({
  type: z.literal("invalidate"),
  scope: z.literal("all"),
  resources: z.array(realtimeResourceSchema).min(1),
  reason: z.string().min(1),
  origin_client_id: z.string().min(1).optional(),
  project_id: z.string().nullable().optional(),
  entity_id: z.string().min(1).optional(),
  occurred_at: z.string().min(1),
});

interface PublishResponse {
  ok: boolean;
}

export function getOriginClientId(c: { req: { header(name: string): string | undefined } }) {
  return c.req.header("X-Client-Id");
}

export async function publishRealtimeInvalidation(
  env: AppEnv["Bindings"],
  event: Omit<RealtimeInvalidationEvent, "type" | "scope" | "occurred_at">,
): Promise<void> {
  const id = env.REALTIME_HUB.idFromName("global");
  const stub = env.REALTIME_HUB.get(id);

  const payload: RealtimeInvalidationEvent = {
    ...event,
    type: "invalidate",
    scope: "all",
    occurred_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };

  try {
    const res = await stub.fetch("https://realtime.internal/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Realtime-Internal-Secret": env.REALTIME_INTERNAL_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Failed to publish realtime invalidation", res.status, payload.reason);
      return;
    }

    const body = await res.json<PublishResponse>().catch(() => ({ ok: false }));
    if (!body.ok) {
      console.error("Realtime hub returned non-ok response", payload.reason);
    }
  } catch (error) {
    console.error("Realtime publish failed", payload.reason, error);
  }
}
