import type { AppEnv } from "../types";

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

interface PublishResponse {
  ok: boolean;
}

export async function publishRealtimeInvalidation(
  env: AppEnv["Bindings"],
  event: Omit<RealtimeInvalidationEvent, "type" | "scope" | "occurred_at">,
): Promise<void> {
  const id = env.REALTIME_HUB.idFromName("global");
  const stub = env.REALTIME_HUB.get(id);

  const payload: RealtimeInvalidationEvent = {
    type: "invalidate",
    scope: "all",
    occurred_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    ...event,
  };

  try {
    const res = await stub.fetch("https://realtime.internal/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
