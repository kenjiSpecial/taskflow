import * as pty from "node-pty";
import type { ServerWebSocket } from "bun";

const SHELL = process.env.SHELL || "/bin/zsh";
const SCROLLBACK_LIMIT = 64 * 1024; // 64KB
const SESSION_IDLE_MS = 5 * 60 * 1000; // 5分

interface WsData {
  todoId: string;
}

interface PtySession {
  pty: pty.IPty;
  todoId: string;
  cwd: string;
  scrollback: string;
  clients: Set<ServerWebSocket<WsData>>;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const sessions = new Map<string, PtySession>();

export function getOrCreateSession(todoId: string, cwd: string): PtySession {
  const existing = sessions.get(todoId);
  if (existing) {
    if (existing.idleTimer) {
      clearTimeout(existing.idleTimer);
      existing.idleTimer = null;
    }
    return existing;
  }

  const ptyProcess = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cwd,
    env: { ...process.env, TERM: "xterm-256color" },
    cols: 120,
    rows: 30,
  });

  const session: PtySession = {
    pty: ptyProcess,
    todoId,
    cwd,
    scrollback: "",
    clients: new Set(),
    idleTimer: null,
  };

  ptyProcess.onData((data) => {
    // scrollbackバッファに追記（上限を超えたら先頭を削る）
    session.scrollback += data;
    if (session.scrollback.length > SCROLLBACK_LIMIT) {
      session.scrollback = session.scrollback.slice(
        session.scrollback.length - SCROLLBACK_LIMIT,
      );
    }
    // 接続中の全クライアントに送信
    const msg = JSON.stringify({ type: "output", data });
    for (const ws of session.clients) {
      try {
        ws.send(msg);
      } catch {
        // 送信失敗は無視（closeハンドラで除去される）
      }
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    const exitMsg = JSON.stringify({ type: "exit", code: exitCode });
    for (const ws of session.clients) {
      try {
        ws.send(exitMsg);
      } catch { /* ignore */ }
    }
    sessions.delete(todoId);
  });

  sessions.set(todoId, session);
  return session;
}

export function attachClient(
  todoId: string,
  ws: ServerWebSocket<WsData>,
  session: PtySession,
): void {
  session.clients.add(ws);
  // 接続成功通知
  ws.send(JSON.stringify({ type: "ready", pid: session.pty.pid }));
  // scrollbackを送信
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

  // クライアントが0になったら5分後にPTYを破棄
  if (session.clients.size === 0 && !session.idleTimer) {
    session.idleTimer = setTimeout(() => {
      destroySession(todoId);
    }, SESSION_IDLE_MS);
  }
}

export function writeInput(todoId: string, data: string): void {
  const session = sessions.get(todoId);
  if (session) {
    session.pty.write(data);
  }
}

export function resizePty(todoId: string, cols: number, rows: number): void {
  const session = sessions.get(todoId);
  if (session) {
    session.pty.resize(cols, rows);
  }
}

export function destroySession(todoId: string): void {
  const session = sessions.get(todoId);
  if (!session) return;
  if (session.idleTimer) clearTimeout(session.idleTimer);
  try {
    session.pty.kill();
  } catch { /* ignore */ }
  sessions.delete(todoId);
}

export function destroyAllSessions(): void {
  for (const todoId of sessions.keys()) {
    destroySession(todoId);
  }
}
