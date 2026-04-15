import type { ServerWebSocket } from "bun";
import { join } from "node:path";

// node は PATH にあることを前提とする
const NODE_BIN = process.execPath.includes("bun")
  ? Bun.which("node") ?? "node"
  : process.execPath;

const PTY_SERVER_SCRIPT = join(import.meta.dir, "pty-server.cjs");
const SESSION_IDLE_MS = 5 * 60 * 1000; // 5分

interface WsData {
  todoId: string;
}

interface PtySession {
  todoId: string;
  cwd: string;
  proc: ReturnType<typeof Bun.spawn>;
  scrollback: string;
  clients: Set<ServerWebSocket<WsData>>;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const sessions = new Map<string, PtySession>();

function broadcast(session: PtySession, msg: string): void {
  for (const ws of session.clients) {
    try {
      ws.send(msg);
    } catch {
      // 送信失敗は無視（closeハンドラで除去される）
    }
  }
}

const SCROLLBACK_LIMIT = 64 * 1024;

function appendScrollback(session: PtySession, data: string): void {
  session.scrollback += data;
  if (session.scrollback.length > SCROLLBACK_LIMIT) {
    session.scrollback = session.scrollback.slice(
      session.scrollback.length - SCROLLBACK_LIMIT,
    );
  }
}

function startReadLoop(session: PtySession): void {
  const proc = session.proc;
  let buf = "";

  (async () => {
    try {
      for await (const chunk of proc.stdout as AsyncIterable<Uint8Array>) {
        buf += new TextDecoder().decode(chunk);
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const line of parts) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as {
              type: string;
              data?: string;
              code?: number;
              message?: string;
            };
            if (msg.type === "output" && typeof msg.data === "string") {
              appendScrollback(session, msg.data);
              broadcast(session, JSON.stringify({ type: "output", data: msg.data }));
            } else if (msg.type === "exit") {
              broadcast(session, JSON.stringify({ type: "exit", code: msg.code ?? 0 }));
              sessions.delete(session.todoId);
            } else if (msg.type === "error") {
              broadcast(session, JSON.stringify({ type: "error", message: msg.message }));
              sessions.delete(session.todoId);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      // stdout closed — session ended
      sessions.delete(session.todoId);
    }
  })();
}

export function getOrCreateSession(todoId: string, cwd: string): PtySession {
  const existing = sessions.get(todoId);
  if (existing) {
    if (existing.idleTimer) {
      clearTimeout(existing.idleTimer);
      existing.idleTimer = null;
    }
    return existing;
  }

  const proc = Bun.spawn([NODE_BIN, PTY_SERVER_SCRIPT, cwd], {
    stdout: "pipe",
    stdin: "pipe",
    stderr: "ignore",
    env: { ...process.env },
  });

  const session: PtySession = {
    todoId,
    cwd,
    proc,
    scrollback: "",
    clients: new Set(),
    idleTimer: null,
  };

  sessions.set(todoId, session);
  startReadLoop(session);

  return session;
}

export function attachClient(
  todoId: string,
  ws: ServerWebSocket<WsData>,
  session: PtySession,
): void {
  session.clients.add(ws);
  ws.send(JSON.stringify({ type: "ready", pid: session.proc.pid }));
  if (session.scrollback) {
    ws.send(JSON.stringify({ type: "output", data: session.scrollback }));
  }
}

export function detachClient(
  todoId: string,
  ws: ServerWebSocket<WsData>,
): void {
  const session = sessions.get(todoId);
  if (!session) return;
  session.clients.delete(ws);

  if (session.clients.size === 0 && !session.idleTimer) {
    session.idleTimer = setTimeout(() => {
      destroySession(todoId);
    }, SESSION_IDLE_MS);
  }
}

function sendToProc(session: PtySession, msg: object): void {
  try {
    session.proc.stdin.write(JSON.stringify(msg) + "\n");
    session.proc.stdin.flush();
  } catch {
    // ignore if proc is dead
  }
}

export function writeInput(todoId: string, data: string): void {
  const session = sessions.get(todoId);
  if (session) sendToProc(session, { type: "input", data });
}

export function resizePty(todoId: string, cols: number, rows: number): void {
  const session = sessions.get(todoId);
  if (session) sendToProc(session, { type: "resize", cols, rows });
}

export function destroySession(todoId: string): void {
  const session = sessions.get(todoId);
  if (!session) return;
  if (session.idleTimer) clearTimeout(session.idleTimer);
  try {
    session.proc.kill();
  } catch { /* ignore */ }
  sessions.delete(todoId);
}

export function destroyAllSessions(): void {
  for (const todoId of [...sessions.keys()]) {
    destroySession(todoId);
  }
}
