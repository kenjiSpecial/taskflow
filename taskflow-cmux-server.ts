#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PORT = 19876;
const HOSTNAME = "127.0.0.1";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://taskflow-ui.pages.dev",
];

// Accept both hyphenated and non-hyphenated UUIDs
const UUID_RE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

const ANSI_RE = /\x1b\[[0-9;]*m/g;

const PROCESS_TIMEOUT_MS = 30_000;

// In-flight requests per sessionId to prevent double workspace creation
const inFlight = new Set<string>();

const MAPPINGS_FILE = join(homedir(), ".taskflow-cmux", "mappings.json");

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "").trim();
}

function findWorkspaceId(sessionId: string): string | null {
  try {
    const data = JSON.parse(readFileSync(MAPPINGS_FILE, "utf-8"));
    const mapping = data.mappings?.find(
      (m: { session_id: string }) => m.session_id === sessionId,
    );
    return mapping?.workspace_id ?? null;
  } catch {
    return null;
  }
}

async function focusWorkspace(workspaceId: string): Promise<boolean> {
  const proc = Bun.spawn(
    ["cmux", "select-workspace", "--workspace", workspaceId],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  return exitCode === 0;
}

async function runCmuxStart(
  sessionId: string,
): Promise<{ ok: boolean; message: string }> {
  const proc = Bun.spawn([cmuxScript, "start", sessionId], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  const timeout = setTimeout(() => {
    proc.kill();
  }, PROCESS_TIMEOUT_MS);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timeout);

  if (exitCode === 0) {
    return { ok: true, message: stripAnsi(stdout) };
  }
  return { ok: false, message: stripAnsi(stderr) || stripAnsi(stdout) };
}

// Resolve the path to taskflow-cmux script (same directory as this file)
const scriptDir = import.meta.dir;
const cmuxScript = `${scriptDir}/taskflow-cmux`;

// Check if port is already in use
try {
  const check = await fetch(`http://${HOSTNAME}:${PORT}/health`);
  if (check.ok) {
    console.error(
      `error: ポート ${PORT} は既に使用中です。既存のサーバーを停止してください:\n  lsof -ti:${PORT} | xargs kill`,
    );
    process.exit(1);
  }
} catch {
  // Port is free — proceed
}

const server = Bun.serve({
  port: PORT,
  hostname: HOSTNAME,

  async fetch(req) {
    const origin = req.headers.get("Origin");
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return jsonResponse({ ok: true }, 200, origin);
    }

    // POST /open — focus existing workspace or create new one
    if (url.pathname === "/open" && req.method === "POST") {
      let body: { sessionId?: string };
      try {
        body = await req.json();
      } catch (e) {
        console.error("JSON parse error:", e);
        return jsonResponse(
          { ok: false, message: "Invalid JSON" },
          400,
          origin,
        );
      }

      console.log("POST /open body:", JSON.stringify(body));
      const sessionId = body.sessionId;
      if (!sessionId || !UUID_RE.test(sessionId)) {
        console.error("Invalid sessionId:", sessionId);
        return jsonResponse(
          { ok: false, message: "Invalid sessionId (UUID format required)" },
          400,
          origin,
        );
      }

      // Check if workspace already exists for this session
      const existingWorkspaceId = findWorkspaceId(sessionId);
      if (existingWorkspaceId) {
        const focused = await focusWorkspace(existingWorkspaceId);
        if (focused) {
          return jsonResponse(
            {
              ok: true,
              action: "focused",
              message: "既存のworkspaceにフォーカスしました",
            },
            200,
            origin,
          );
        }
        // Workspace mapping exists but workspace is gone — fall through to create
      }

      // Prevent duplicate execution
      if (inFlight.has(sessionId)) {
        return jsonResponse(
          { ok: false, message: "このセッションは現在処理中です" },
          409,
          origin,
        );
      }

      inFlight.add(sessionId);
      try {
        const result = await runCmuxStart(sessionId);
        return jsonResponse(
          { ...result, action: "created" },
          result.ok ? 200 : 422,
          origin,
        );
      } finally {
        inFlight.delete(sessionId);
      }
    }

    // Legacy: POST /start (same as /open but always creates)
    if (url.pathname === "/start" && req.method === "POST") {
      let body: { sessionId?: string };
      try {
        body = await req.json();
      } catch {
        return jsonResponse(
          { ok: false, message: "Invalid JSON" },
          400,
          origin,
        );
      }

      const sessionId = body.sessionId;
      if (!sessionId || !UUID_RE.test(sessionId)) {
        return jsonResponse(
          { ok: false, message: "Invalid sessionId (UUID format required)" },
          400,
          origin,
        );
      }

      if (inFlight.has(sessionId)) {
        return jsonResponse(
          { ok: false, message: "このセッションは現在処理中です" },
          409,
          origin,
        );
      }

      inFlight.add(sessionId);
      try {
        const result = await runCmuxStart(sessionId);
        return jsonResponse(
          { ...result, action: "created" },
          result.ok ? 200 : 422,
          origin,
        );
      } finally {
        inFlight.delete(sessionId);
      }
    }

    return jsonResponse({ ok: false, message: "Not found" }, 404, origin);
  },

  error(error) {
    console.error("Server error:", error);
    return Response.json(
      { ok: false, message: "Internal server error" },
      { status: 500 },
    );
  },
});

console.log(`cmux bridge server listening on http://${HOSTNAME}:${PORT}`);
