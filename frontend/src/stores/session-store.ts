import { signal, computed } from "@preact/signals";
import type { WorkSession, SessionLog, Todo, CreateSessionInput, UpdateSessionInput } from "../lib/api";
import * as api from "../lib/api";

export const sessions = signal<WorkSession[]>([]);
export const sessionLogs = signal<SessionLog[]>([]);
export const linkedTasks = signal<Todo[]>([]);
export const loading = signal(false);
export const error = signal<string | null>(null);

export const filter = signal<{
  status?: string;
}>({});

export const filteredSessions = computed(() => {
  return sessions.value.filter((s) => {
    if (filter.value.status && s.status !== filter.value.status) return false;
    return true;
  });
});

export const activeSessions = computed(() =>
  sessions.value.filter((s) => s.status === "active" || s.status === "paused"),
);

export async function loadSessions() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.fetchSessions({ limit: "100", sort: "updated_at", order: "desc" });
    sessions.value = res.sessions;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

export async function addSession(data: CreateSessionInput) {
  const res = await api.createSession(data);
  sessions.value = [res.session, ...sessions.value];
  return res.session;
}

export async function editSession(id: string, data: UpdateSessionInput) {
  const res = await api.updateSession(id, data);
  sessions.value = sessions.value.map((s) => (s.id === id ? res.session : s));
}

export async function removeSession(id: string) {
  await api.deleteSession(id);
  sessions.value = sessions.value.filter((s) => s.id !== id);
}

export async function loadSessionLogs(sessionId: string) {
  try {
    const res = await api.fetchSessionLogs(sessionId, { limit: "100", order: "asc" });
    sessionLogs.value = res.logs;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

export async function addSessionLog(sessionId: string, content: string) {
  const res = await api.createSessionLog(sessionId, { content });
  sessionLogs.value = [...sessionLogs.value, res.log];
  sessions.value = sessions.value.map((s) =>
    s.id === sessionId ? { ...s, updated_at: res.log.created_at } : s,
  );
  return res.log;
}

// --- Session Tasks ---

export async function loadLinkedTasks(sessionId: string) {
  try {
    const res = await api.fetchSessionTasks(sessionId);
    linkedTasks.value = res.tasks;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

export async function linkTask(sessionId: string, todoId: string) {
  await api.linkSessionTask(sessionId, todoId);
  await loadLinkedTasks(sessionId);
  // セッション一覧の進捗も更新
  await loadSessions();
}

export async function unlinkTask(sessionId: string, todoId: string) {
  await api.unlinkSessionTask(sessionId, todoId);
  linkedTasks.value = linkedTasks.value.filter((t) => t.id !== todoId);
  await loadSessions();
}
