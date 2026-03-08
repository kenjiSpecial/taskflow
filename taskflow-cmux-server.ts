#!/usr/bin/env bun

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  getModel,
  stream as piStream,
  validateToolCall,
  type Context,
  type Message,
} from "@mariozechner/pi-ai";
import { agentTools, destructiveTools, toolApiMap } from "./agent-tools";

const PORT = 19876;
const HOSTNAME = "127.0.0.1";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
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

const CONFIG_DIR = join(homedir(), ".taskflow-cmux");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const MAPPINGS_FILE = join(CONFIG_DIR, "mappings.json");
const CERT_FILE = join(CONFIG_DIR, "cert.pem");
const KEY_FILE = join(CONFIG_DIR, "key.pem");

const DEFAULT_API_URL = "https://taskflow.kenji-draemon.workers.dev";
const DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-4";
const MAX_AGENT_STEPS = 10;
const AGENT_TIMEOUT_MS = 60_000;

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

// ─── Agent Chat Config ───────────────────────────────────────────────────────

interface AgentConfig {
  apiUrl: string;
  apiToken: string;
  openrouterApiKey: string;
  chatModel: string;
}

function loadAgentConfig(): AgentConfig {
  let fileConfig: Record<string, unknown> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    } catch {
      // ignore
    }
  }

  return {
    apiUrl:
      process.env.TASKFLOW_API_URL ||
      (fileConfig.api_url as string) ||
      DEFAULT_API_URL,
    apiToken:
      process.env.TASKFLOW_API_TOKEN ||
      (fileConfig.api_token as string) ||
      "",
    openrouterApiKey:
      process.env.OPENROUTER_API_KEY ||
      (fileConfig.openrouter_api_key as string) ||
      "",
    chatModel:
      (fileConfig.chat_model as string) || DEFAULT_CHAT_MODEL,
  };
}

// ─── SSE Helpers ─────────────────────────────────────────────────────────────

function sseEvent(
  controller: ReadableStreamDirectController,
  event: string,
  data: unknown,
): void {
  controller.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Taskflow API Client ─────────────────────────────────────────────────────

async function callTaskflowApi(
  config: AgentConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>,
): Promise<unknown> {
  let url = `${config.apiUrl}${path}`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    url += `?${new URLSearchParams(queryParams).toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    ...(body && method !== "GET" && method !== "DELETE"
      ? { body: JSON.stringify(body) }
      : {}),
  });

  return res.json();
}

// ─── Tool Executor ───────────────────────────────────────────────────────────

async function executeTool(
  config: AgentConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ result: unknown; error?: string }> {
  const mapping = toolApiMap[toolName];
  if (!mapping) {
    return { result: null, error: `Unknown tool: ${toolName}` };
  }

  try {
    const path = mapping.path(args);
    const body = mapping.body?.(args);
    const queryParams = mapping.queryParams?.(args);
    const result = await callTaskflowApi(config, mapping.method, path, body, queryParams);
    return { result };
  } catch (e) {
    return { result: null, error: String(e) };
  }
}

// ─── Chat Request Types ──────────────────────────────────────────────────────

interface ViewContext {
  currentPage: string;
  activeProjectId?: string;
  activeProjectName?: string;
  activeFilters?: {
    status?: string;
    tags?: string[];
  };
}

interface ChatRequest {
  message: string;
  conversation_id?: string;
  context?: ViewContext;
  history?: Message[];
}

// ─── System Prompt Builder ───────────────────────────────────────────────────

function buildSystemPrompt(viewContext?: ViewContext): string {
  let prompt = `あなたはTaskflowのタスク管理アシスタントです。
ユーザーの自然言語での指示に基づいて、タスク・プロジェクト・セッション・タグの操作を行います。

ルール:
- 操作を行う前に、必要に応じてツールで現状を確認してください
- 削除操作は慎重に行ってください
- 結果は簡潔に日本語で報告してください
- 複数の操作が必要な場合は順番に実行してください`;

  if (viewContext) {
    prompt += "\n\n現在のユーザーの画面状態:";
    prompt += `\n- ページ: ${viewContext.currentPage}`;
    if (viewContext.activeProjectId) {
      prompt += `\n- プロジェクト: ${viewContext.activeProjectName || "不明"} (id: ${viewContext.activeProjectId})`;
    }
    if (viewContext.activeFilters) {
      if (viewContext.activeFilters.status) {
        prompt += `\n- ステータスフィルタ: ${viewContext.activeFilters.status}`;
      }
      if (viewContext.activeFilters.tags?.length) {
        prompt += `\n- タグフィルタ: ${viewContext.activeFilters.tags.join(", ")}`;
      }
    }
    prompt +=
      '\n\nユーザーが「タスクを追加して」等と言った場合、特に指定がなければこのプロジェクトにタスクを追加してください。';
  }

  return prompt;
}

// ─── Chat Handler (SSE) ─────────────────────────────────────────────────────

// Pending confirmations: toolCallId → resolve function
const pendingConfirmations = new Map<
  string,
  (approved: boolean) => void
>();

async function handleChat(
  req: Request,
  origin: string | null,
): Promise<Response> {
  const config = loadAgentConfig();

  if (!config.openrouterApiKey) {
    return Response.json(
      { ok: false, message: "OpenRouter APIキーが設定されていません" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }

  let chatReq: ChatRequest;
  try {
    chatReq = await req.json();
  } catch {
    return Response.json(
      { ok: false, message: "Invalid JSON" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  if (!chatReq.message?.trim()) {
    return Response.json(
      { ok: false, message: "message is required" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    AGENT_TIMEOUT_MS,
  );

  const body = new ReadableStream({
    type: "direct",
    async pull(controller) {
      try {
        const model = getModel("openrouter", config.chatModel as "auto");
        const systemPrompt = buildSystemPrompt(chatReq.context);

        // Build messages from history or start fresh
        const messages: Message[] = chatReq.history || [];
        messages.push({
          role: "user",
          content: chatReq.message,
          timestamp: Date.now(),
        });

        const context: Context = {
          systemPrompt,
          messages,
          tools: agentTools,
        };

        let steps = 0;

        // Agent loop: stream → handle tool calls → repeat
        while (steps < MAX_AGENT_STEPS) {
          steps++;

          // Collect tool results during streaming; push after assistant message
          const pendingToolResults: Message[] = [];

          const s = piStream(model, context, {
            apiKey: config.openrouterApiKey,
            signal: abortController.signal,
            maxTokens: 4096,
          });

          for await (const event of s) {
            if (event.type === "text_delta") {
              sseEvent(controller, "token", { content: event.delta });
            } else if (event.type === "toolcall_end") {
              const toolCall = event.toolCall;

              sseEvent(controller, "tool_call", {
                tool_call_id: toolCall.id,
                tool_name: toolCall.name,
                args: toolCall.arguments,
              });

              // Check if destructive - wait for confirmation
              if (destructiveTools.has(toolCall.name)) {
                sseEvent(controller, "confirm", {
                  tool_call_id: toolCall.id,
                  tool_name: toolCall.name,
                  args: toolCall.arguments,
                  description: `${toolCall.name} を実行しますか？`,
                });

                const approved = await new Promise<boolean>((resolve) => {
                  pendingConfirmations.set(toolCall.id, resolve);
                  // Auto-reject after 30s
                  setTimeout(() => {
                    if (pendingConfirmations.has(toolCall.id)) {
                      pendingConfirmations.delete(toolCall.id);
                      resolve(false);
                    }
                  }, 30_000);
                });

                if (!approved) {
                  pendingToolResults.push({
                    role: "toolResult",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: [
                      { type: "text", text: "ユーザーがこの操作をキャンセルしました。" },
                    ],
                    isError: false,
                    timestamp: Date.now(),
                  });

                  sseEvent(controller, "tool_result", {
                    tool_call_id: toolCall.id,
                    cancelled: true,
                  });
                  continue;
                }
              }

              // Execute the tool
              const { result, error } = await executeTool(
                config,
                toolCall.name,
                toolCall.arguments,
              );

              const resultText = error
                ? `Error: ${error}`
                : JSON.stringify(result);

              pendingToolResults.push({
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: resultText }],
                isError: !!error,
                timestamp: Date.now(),
              });

              sseEvent(controller, "tool_result", {
                tool_call_id: toolCall.id,
                tool_name: toolCall.name,
                result: error ? { error } : result,
              });
            } else if (event.type === "error") {
              sseEvent(controller, "error", {
                message: event.error?.errorMessage || "LLM error",
              });
            }
          }

          // Check if we need to continue (tool use means model wants to process results)
          const lastResult = await s.result();

          // Add assistant message (with tool_use blocks) BEFORE tool results
          context.messages.push(lastResult);
          // Then add tool results
          for (const tr of pendingToolResults) {
            context.messages.push(tr);
          }

          if (lastResult.stopReason !== "toolUse") {
            // Model finished with text response
            break;
          }
          // Loop continues: model made tool calls and needs to process results
        }

        sseEvent(controller, "done", {
          conversation_id: chatReq.conversation_id || null,
        });
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Unknown error";
        sseEvent(controller, "error", { message: msg });
      } finally {
        clearTimeout(timeout);
        controller.close();
      }
    },
  } as unknown as UnderlyingSource);

  return new Response(body, {
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Resolve the path to taskflow-cmux script (same directory as this file)
const scriptDir = import.meta.dir;
const cmuxScript = `${scriptDir}/taskflow-cmux`;

// Load TLS certificates
let tlsConfig: { cert: string; key: string } | undefined;
try {
  tlsConfig = {
    cert: readFileSync(CERT_FILE, "utf-8"),
    key: readFileSync(KEY_FILE, "utf-8"),
  };
} catch {
  console.warn(
    `warn: TLS証明書が見つかりません (${CERT_FILE})。HTTPで起動します。\n` +
      "  HTTPS化: mkcert -install && mkcert -cert-file ~/.taskflow-cmux/cert.pem -key-file ~/.taskflow-cmux/key.pem localhost 127.0.0.1",
  );
}

const protocol = tlsConfig ? "https" : "http";

// Check if port is already in use
try {
  const check = await fetch(`${protocol}://${HOSTNAME}:${PORT}/health`, {
    tls: { rejectUnauthorized: false },
  } as RequestInit);
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
  ...(tlsConfig ? { tls: tlsConfig } : {}),

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

    // POST /chat — agent chat with SSE streaming
    if (url.pathname === "/chat" && req.method === "POST") {
      return handleChat(req, origin);
    }

    // POST /chat/confirm — confirm destructive tool execution
    if (url.pathname === "/chat/confirm" && req.method === "POST") {
      let body: { tool_call_id?: string; approved?: boolean };
      try {
        body = await req.json();
      } catch {
        return jsonResponse(
          { ok: false, message: "Invalid JSON" },
          400,
          origin,
        );
      }

      const { tool_call_id, approved } = body;
      if (!tool_call_id) {
        return jsonResponse(
          { ok: false, message: "tool_call_id is required" },
          400,
          origin,
        );
      }

      const resolve = pendingConfirmations.get(tool_call_id);
      if (!resolve) {
        return jsonResponse(
          { ok: false, message: "No pending confirmation for this tool_call_id" },
          404,
          origin,
        );
      }

      pendingConfirmations.delete(tool_call_id);
      resolve(approved === true);

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

console.log(
  `cmux bridge server listening on ${protocol}://${HOSTNAME}:${PORT}`,
);
