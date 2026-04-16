import type { ServerWebSocket } from "bun";
import { join } from "node:path";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";

// node は PATH にあることを前提とする
const NODE_BIN = process.execPath.includes("bun")
  ? Bun.which("node") ?? "node"
  : process.execPath;

function resolveCwd(cwd: string): string {
  try {
    if (cwd && existsSync(cwd) && statSync(cwd).isDirectory()) return cwd;
  } catch { /* ignore */ }
  console.warn(`[pty] cwd "${cwd}" が無効なため $HOME にフォールバック`);
  return homedir();
}

const PTY_SERVER_SCRIPT = join(import.meta.dir, "pty-server.cjs");
const SESSION_IDLE_MS = 5 * 60 * 1000; // 5分

interface WsData {
  todoId: string;
}

interface PtySession {
  todoId: string;
  cwd: string;
  zellijSession: string | undefined;
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
  const tag = session.todoId.slice(0, 8);

  (async () => {
    console.log(`[pty ${tag}] readLoop start`);
    try {
      const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log(`[pty ${tag}] stdout closed (done)`);
          break;
        }
        buf += decoder.decode(value, { stream: true });
        console.log(`[pty ${tag}] chunk ${value.byteLength}bytes buf=${buf.length}`);
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
              const payload = JSON.stringify({ type: "output", data: msg.data });
              console.log(`[pty ${tag}] broadcast output ${msg.data.length}chars to ${session.clients.size}clients`);
              broadcast(session, payload);
            } else if (msg.type === "exit") {
              console.log(`[pty ${tag}] got exit code=${msg.code}`);
              broadcast(session, JSON.stringify({ type: "exit", code: msg.code ?? 0 }));
              sessions.delete(session.todoId);
            } else if (msg.type === "error") {
              console.error(`[pty ${tag}] got error: ${msg.message}`);
              broadcast(session, JSON.stringify({ type: "error", message: msg.message }));
              sessions.delete(session.todoId);
            }
          } catch (e) {
            console.warn(`[pty ${tag}] parse error: ${String(e)} line=${line.slice(0, 80)}`);
          }
        }
      }
    } catch (e) {
      console.error(`[pty ${tag}] readLoop error:`, e);
      sessions.delete(session.todoId);
    }
    console.log(`[pty ${tag}] readLoop end`);
  })();
}

export function getOrCreateSession(todoId: string, cwd: string, zellijSession?: string): PtySession {
  const existing = sessions.get(todoId);
  if (existing) {
    if (existing.zellijSession !== zellijSession) {
      // zellijSession が変わった: 古い PTY を破棄して新規作成
      if (existing.idleTimer) clearTimeout(existing.idleTimer);
      try { existing.proc.kill(); } catch { /* ignore */ }
      sessions.delete(todoId);
      // fall through to create new session
    } else {
      if (existing.idleTimer) {
        clearTimeout(existing.idleTimer);
        existing.idleTimer = null;
      }
      return existing;
    }
  }

  const resolvedCwd = resolveCwd(cwd);
  console.log(`[pty] spawn todoId=${todoId} cwd=${resolvedCwd} node=${NODE_BIN}${zellijSession ? ` zellij=${zellijSession}` : ""}`);

  const spawnArgs = [NODE_BIN, PTY_SERVER_SCRIPT, resolvedCwd];
  if (zellijSession) spawnArgs.push(zellijSession);

  const proc = Bun.spawn(spawnArgs, {
    stdout: "pipe",
    stdin: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  // stderr を吸い上げてログに流す
  (async () => {
    const dec = new TextDecoder();
    try {
      for await (const chunk of proc.stderr as AsyncIterable<Uint8Array>) {
        console.error(`[pty-server ${todoId.slice(0, 8)}] ${dec.decode(chunk)}`);
      }
    } catch { /* ignore */ }
  })();

  proc.exited.then((code) => {
    console.log(`[pty] exited todoId=${todoId} code=${code}`);
  });

  const session: PtySession = {
    todoId,
    cwd: resolvedCwd,
    zellijSession,
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
  const tag = todoId.slice(0, 8);
  console.log(`[pty ${tag}] attach client, now ${session.clients.size}clients, scrollback=${session.scrollback.length}chars`);
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

async function sendToProc(session: PtySession, msg: object): Promise<void> {
  try {
    session.proc.stdin.write(JSON.stringify(msg) + "\n");
    await session.proc.stdin.flush();
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
