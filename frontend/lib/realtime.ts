import type { QueryClient } from "@tanstack/react-query";
import { todoKeys } from "./hooks/useTodos";
import { projectKeys } from "./hooks/useProjects";
import { sessionKeys } from "./hooks/useSessions";
import { tagKeys } from "./hooks/useTags";
import { getClientId } from "./client-id";

type RealtimeResource =
  | "projects"
  | "todos"
  | "sessions"
  | "tags"
  | "session_logs"
  | "session_tasks";

interface RealtimeEvent {
  type: "invalidate" | "ready" | "pong";
  resources?: RealtimeResource[];
  origin_client_id?: string;
}

const RESOURCE_KEY_MAP: Record<RealtimeResource, readonly string[]> = {
  projects: projectKeys.all,
  todos: todoKeys.all,
  sessions: sessionKeys.all,
  tags: tagKeys.all,
  session_logs: sessionKeys.all,
  session_tasks: sessionKeys.all,
};

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;
const FLUSH_DEBOUNCE_MS = 150;

function resolveRealtimeUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const token = process.env.NEXT_PUBLIC_API_TOKEN || "";

  const url = apiBase
    ? new URL(apiBase)
    : new URL("/api/realtime", window.location.origin);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/realtime";

  if (token) {
    url.searchParams.set("token", token);
  }
  url.searchParams.set("client_id", getClientId());

  return url.toString();
}

export function connectRealtime(queryClient: QueryClient): () => void {
  let socket: WebSocket | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let hasConnectedOnce = false;
  let disposed = false;
  const pendingResources = new Set<RealtimeResource>();

  function clearTimers() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function queueResource(resource: RealtimeResource) {
    pendingResources.add(resource);
    if (flushTimer !== null) return;

    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushPendingResources();
    }, FLUSH_DEBOUNCE_MS);
  }

  function flushPendingResources() {
    const resources = new Set(pendingResources);
    pendingResources.clear();

    for (const resource of resources) {
      const queryKey = RESOURCE_KEY_MAP[resource];
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    }
  }

  function queueInitialSync() {
    queueResource("projects");
    queueResource("todos");
    queueResource("sessions");
    queueResource("tags");
  }

  function scheduleReconnect() {
    if (reconnectTimer !== null || disposed) return;

    reconnectAttempt += 1;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** (reconnectAttempt - 1),
      RECONNECT_MAX_MS,
    );
    const jitter = Math.floor(Math.random() * 250);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay + jitter);
  }

  function connect() {
    if (disposed) return;

    if (
      socket &&
      (socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    clearTimers();

    const ws = new WebSocket(resolveRealtimeUrl());
    socket = ws;

    ws.addEventListener("open", () => {
      const shouldRunInitialSync = hasConnectedOnce;
      hasConnectedOnce = true;
      reconnectAttempt = 0;
      if (shouldRunInitialSync) {
        queueInitialSync();
      }
    });

    ws.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data as string) as RealtimeEvent;
        if (
          payload.origin_client_id &&
          payload.origin_client_id === getClientId()
        ) {
          return;
        }
        if (payload.type !== "invalidate" || !payload.resources?.length) return;
        for (const resource of payload.resources) {
          queueResource(resource);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.addEventListener("error", () => {
      // Error will be followed by close event
    });

    ws.addEventListener("close", () => {
      if (socket !== ws) return;
      socket = null;
      if (!disposed) {
        scheduleReconnect();
      }
    });
  }

  connect();

  return () => {
    disposed = true;
    clearTimers();
    pendingResources.clear();
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close();
    }
    socket = null;
  };
}
