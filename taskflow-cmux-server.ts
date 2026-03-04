#!/usr/bin/env bun

const PORT = 19876;
const HOSTNAME = "127.0.0.1";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://taskflow-ui.pages.dev",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ANSI_RE = /\x1b\[[0-9;]*m/g;

const PROCESS_TIMEOUT_MS = 30_000;

// In-flight requests per sessionId to prevent double workspace creation
const inFlight = new Set<string>();

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// Resolve the path to taskflow-cmux script (same directory as this file)
const scriptDir = import.meta.dir;
const cmuxScript = `${scriptDir}/taskflow-cmux`;

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

    // POST /start
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
        const proc = Bun.spawn([cmuxScript, "start", sessionId], {
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env },
        });

        // Timeout handling
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
          return jsonResponse(
            { ok: true, message: stripAnsi(stdout) },
            200,
            origin,
          );
        }
        return jsonResponse(
          { ok: false, message: stripAnsi(stderr) || stripAnsi(stdout) },
          422,
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
