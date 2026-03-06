import { computed, signal } from "@preact/signals";
import { loadProjects } from "./project-store";
import { loadTodos } from "./todo-store";
import { loadSessions, loadSessionLogs, loadLinkedTasks } from "./session-store";
import { loadTags } from "./tag-store";
import { detailExpandedSessionId, expandedSessionId } from "./app-store";
import { getClientId } from "../lib/client-id";

type RealtimeStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";
type RealtimeResource = "projects" | "todos" | "sessions" | "tags" | "session_logs" | "session_tasks";

interface RealtimeEvent {
  type: "invalidate" | "ready" | "pong";
  resources?: RealtimeResource[];
  origin_client_id?: string;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;
const FLUSH_DEBOUNCE_MS = 150;

export const realtimeStatus = signal<RealtimeStatus>("idle");
export const lastRealtimeEventAt = signal<string | null>(null);
export const lastRealtimeError = signal<string | null>(null);

const socketRef = signal<WebSocket | null>(null);
const reconnectAttempt = signal(0);
const currentOpenSessionId = computed(() => detailExpandedSessionId.value ?? expandedSessionId.value);

let reconnectTimer: number | null = null;
let flushTimer: number | null = null;
const pendingResources = new Set<RealtimeResource>();

function resolveRealtimeUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL;
  const token = import.meta.env.VITE_API_TOKEN || "";

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

function queueResource(resource: RealtimeResource) {
  pendingResources.add(resource);
  if (flushTimer !== null) return;

  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushPendingResources();
  }, FLUSH_DEBOUNCE_MS);
}

async function flushPendingResources() {
  const resources = new Set(pendingResources);
  pendingResources.clear();

  const tasks: Promise<unknown>[] = [];

  if (resources.has("projects")) tasks.push(loadProjects());
  if (resources.has("todos")) tasks.push(loadTodos());
  if (resources.has("sessions")) tasks.push(loadSessions());
  if (resources.has("tags")) tasks.push(loadTags());

  const sessionId = currentOpenSessionId.value;
  if (sessionId && resources.has("session_logs")) tasks.push(loadSessionLogs(sessionId));
  if (sessionId && resources.has("session_tasks")) tasks.push(loadLinkedTasks(sessionId));

  await Promise.allSettled(tasks);
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return;

  const attempt = reconnectAttempt.value + 1;
  reconnectAttempt.value = attempt;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
  const jitter = Math.floor(Math.random() * 250);

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectRealtime();
  }, delay + jitter);
}

function clearTimers() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function queueInitialSync() {
  queueResource("projects");
  queueResource("todos");
  queueResource("sessions");
  queueResource("tags");
  if (currentOpenSessionId.value) {
    queueResource("session_logs");
    queueResource("session_tasks");
  }
}

export function connectRealtime() {
  const existing = socketRef.value;
  if (existing && (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)) {
    return disconnectRealtime;
  }

  clearTimers();
  lastRealtimeError.value = null;
  realtimeStatus.value = "connecting";

  const socket = new WebSocket(resolveRealtimeUrl());
  socketRef.value = socket;

  socket.addEventListener("open", () => {
    reconnectAttempt.value = 0;
    realtimeStatus.value = "connected";
    queueInitialSync();
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data as string) as RealtimeEvent;
      lastRealtimeEventAt.value = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      if (payload.origin_client_id && payload.origin_client_id === getClientId()) return;
      if (payload.type !== "invalidate" || !payload.resources) return;
      for (const resource of payload.resources) {
        queueResource(resource);
      }
    } catch (error) {
      lastRealtimeError.value = error instanceof Error ? error.message : String(error);
    }
  });

  socket.addEventListener("error", () => {
    realtimeStatus.value = "error";
    lastRealtimeError.value = "Realtime connection error";
  });

  socket.addEventListener("close", () => {
    if (socketRef.value === socket) {
      socketRef.value = null;
    }
    if (realtimeStatus.value !== "idle") {
      realtimeStatus.value = "disconnected";
      scheduleReconnect();
    }
  });

  return disconnectRealtime;
}

export function disconnectRealtime() {
  clearTimers();
  pendingResources.clear();
  reconnectAttempt.value = 0;
  realtimeStatus.value = "idle";

  const socket = socketRef.value;
  socketRef.value = null;
  if (socket && socket.readyState < WebSocket.CLOSING) {
    socket.close();
  }
}
