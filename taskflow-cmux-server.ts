#!/usr/bin/env bun

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  getOrCreateSession,
  attachClient,
  detachClient,
  writeInput,
  resizePty,
  destroyAllSessions,
} from "./pty-manager";
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
const DEFAULT_CHAT_MODEL = "minimax/minimax-m2.7";
const AVAILABLE_MODELS = [
  "minimax/minimax-m2.7",
  "google/gemini-3-flash-preview",
  "anthropic/claude-sonnet-4.6",
  "moonshotai/kimi-k2.5",
  "zai/glm-5.1",
  "zai/glm-5",
  "zai/glm-4.5",
];

// モデルIDからプロバイダーとモデル名を解決する
// "zai/glm-5.1" → { provider: "zai", modelId: "glm-5.1" }
// "minimax/minimax-m2.7" → { provider: "openrouter", modelId: "minimax/minimax-m2.7" }
function resolveModel(modelStr: string): { provider: string; modelId: string } {
  const [prefix, ...rest] = modelStr.split("/");
  if (prefix === "zai" && rest.length > 0) {
    return { provider: "zai", modelId: rest.join("/") };
  }
  return { provider: "openrouter", modelId: modelStr };
}
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
  zaiApiKey: string;
  chatModel: string;
}

// Runtime model override (not persisted, resets on restart)
let runtimeModel: string | null = null;

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
    apiToken: (() => {
      const envToken = process.env.TASKFLOW_API_TOKEN ?? "";
      // mprocsが${...}を展開せずそのまま渡す場合があるため除外
      const resolvedEnvToken = envToken.startsWith("${") ? "" : envToken;
      return resolvedEnvToken || (fileConfig.api_token as string) || "";
    })(),
    openrouterApiKey:
      process.env.OPENROUTER_API_KEY ||
      (fileConfig.openrouter_api_key as string) ||
      "",
    zaiApiKey:
      process.env.ZAI_API_KEY ||
      (fileConfig.zai_api_key as string) ||
      "",
    chatModel:
      runtimeModel ||
      (fileConfig.chat_model as string) ||
      DEFAULT_CHAT_MODEL,
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
  let prompt = `あなたはTaskFlowのタスク管理アシスタントです。日本語で簡潔に応答します。

## できること
タスク・プロジェクト・セッション・タグの作成・更新・削除、タスクログの記録、進捗確認。

## ステータスフロー
タスクは8段階で進行: backlog → todo → ready_for_code → in_progress → review → waiting → ready_for_publish → done
- backlog: 未整理・いつかやる
- todo: 次やる
- ready_for_code: 仕様確定済み、AIコーディングエージェントが着手可能
- in_progress: 作業中
- review: レビュー待ち
- waiting: 外部ブロッカー待ち
- ready_for_publish: 実装完了、公開待ち
- done: 完了

## 参照形式
- \`[タスク: タイトル (ID: xxx)]\` — そのタスクを操作対象として認識する。IDを使って get_todo や update_todo を直接呼び出せる。確認なしに操作してよい。
- \`[プロジェクト: 名前 (ID: xxx)]\` — そのプロジェクトを操作対象として認識する。IDを使って get_project や get_todos (project_id フィルタ) を直接呼び出せる。

## 基本ルール
- 操作前にツールで現状を確認する
- 削除は慎重に（確認ダイアログが出る）
- 結果は簡潔に報告
- 複数操作は順次実行
- 重要な操作の後は add_todo_log (source=ai) で記録を残す（例: ステータス変更理由、作業メモ）

## タスク作成ルール
タスク作成を依頼されたら（「タスクのみ」「紐付け不要」と明示された場合は省略）:
1. list_projects で既存プロジェクトを確認し、最も関連性の高いプロジェクトを提案
2. 作業セッション作成・リンクの要否を確認
- 確認は1回のメッセージにまとめる
- 不要と言われたら紐付けなしで作成
- セッション作成時は同プロジェクトに紐付け、link_task_to_session でリンク`;

  if (viewContext) {
    prompt += "\n\n## 現在のページ";
    prompt += `\nユーザーは「${viewContext.currentPage}」ページを表示中。`;
    if (viewContext.activeProjectId) {
      prompt += `\nプロジェクト: ${viewContext.activeProjectName || "不明"} (id: ${viewContext.activeProjectId})`;
    }
    if (viewContext.activeFilters) {
      if (viewContext.activeFilters.status) {
        prompt += `\nステータスフィルタ: ${viewContext.activeFilters.status}`;
      }
      if (viewContext.activeFilters.tags?.length) {
        prompt += `\nタグフィルタ: ${viewContext.activeFilters.tags.join(", ")}`;
      }
    }

    // ページ別の提案指示
    const page = viewContext.currentPage;
    if (page === "kanban" || page === "/") {
      prompt += `\n\nこのページでは: タスク作成、ステータス一括変更、フィルタの相談、今日のタスク確認ができます。`;
    } else if (page.startsWith("task-detail") || page.startsWith("/tasks/")) {
      prompt += `\n\nこのページでは: ステータス変更、ログ追加、子タスク作成、セッション紐付け、詳細編集ができます。`;
      prompt += `\nタスクの詳細を知るには get_todo を使ってください。`;
    } else if (page.startsWith("project-detail") || page.startsWith("/projects/")) {
      prompt += `\n\nこのページでは: タスク追加、セッション管理、進捗確認ができます。`;
    } else if (page.startsWith("session-detail") || page.startsWith("/sessions/")) {
      prompt += `\n\nこのページでは: タスクリンク、ログ追加、セッションステータス変更ができます。`;
    }

    prompt += `\nタスク作成時、特にプロジェクト指定がなければ現在表示中のプロジェクトを第一候補として提案してください。`;

    prompt += `\n\n## 自動挨拶モード
ユーザーのメッセージが空（自動挨拶リクエスト）の場合:
- 現在のページに応じて「ここでは○○ができます」と簡潔に提案する（2-3行）
- ツールは呼ばない
- 質問で終える（例: 「何かお手伝いできますか？」）`;
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

  const { provider: chatProvider } = resolveModel(config.chatModel);
  if (chatProvider === "openrouter" && !config.openrouterApiKey) {
    return Response.json(
      { ok: false, message: "OpenRouter APIキーが設定されていません" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
  if (chatProvider === "zai" && !config.zaiApiKey) {
    return Response.json(
      { ok: false, message: "z.ai APIキーが設定されていません（~/.taskflow-cmux/config.jsonのzai_api_keyを設定してください）" },
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
        const { provider: modelProvider, modelId } = resolveModel(config.chatModel);
        const model = getModel(modelProvider, modelId as "auto");
        const systemPrompt = buildSystemPrompt(chatReq.context);

        // Build messages from history or start fresh
        // Normalize history: pi-ai expects assistant content as block arrays, not plain strings
        const rawHistory: Message[] = (chatReq.history || []).map((m: Message) => {
          if (m.role === "assistant" && typeof m.content === "string") {
            return {
              ...m,
              content: [{ type: "text", text: m.content }],
            };
          }
          return m;
        });
        const messages: Message[] = rawHistory;
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

          let lastResult;
          try {
            const apiKey = modelProvider === "zai" ? config.zaiApiKey : config.openrouterApiKey;
            const s = piStream(model, context, {
              apiKey,
              signal: abortController.signal,
              maxTokens: 16384,
              reasoningEffort: "low",
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
                console.error(`[chat] LLM stream error (step ${steps}):`, event.error);
                sseEvent(controller, "error", {
                  message: event.error?.errorMessage || "LLM error",
                });
              }
            }

            lastResult = await s.result();
          } catch (streamErr) {
            const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
            console.error(`[chat] Stream error (step ${steps}):`, errMsg);
            sseEvent(controller, "error", { message: "LLMの応答中にエラーが発生しました" });
            break;
          }

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
          model: config.chatModel,
        });
      } catch (e) {
        console.error("[chat] Unhandled error:", e);
        sseEvent(controller, "error", { message: "チャット処理中にエラーが発生しました" });
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
  idleTimeout: 120,
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

    // GET /chat/config — チャット設定情報
    if (url.pathname === "/chat/config" && req.method === "GET") {
      const config = loadAgentConfig();
      return jsonResponse(
        { model: config.chatModel, availableModels: AVAILABLE_MODELS },
        200,
        origin,
      );
    }

    // POST /chat/config — モデル変更
    if (url.pathname === "/chat/config" && req.method === "POST") {
      let body: { model?: string };
      try {
        body = await req.json();
      } catch {
        return jsonResponse(
          { ok: false, message: "Invalid JSON" },
          400,
          origin,
        );
      }
      if (!body.model || !AVAILABLE_MODELS.includes(body.model)) {
        return jsonResponse(
          { ok: false, message: "Invalid model" },
          400,
          origin,
        );
      }
      runtimeModel = body.model;
      return jsonResponse({ ok: true, model: runtimeModel }, 200, origin);
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

    // WebSocket upgrade: /ws/terminal/:todoId
    if (url.pathname.startsWith("/ws/terminal/")) {
      const todoId = url.pathname.split("/")[3];
      if (!todoId || !UUID_RE.test(todoId)) {
        return new Response("Invalid todoId", { status: 400 });
      }
      const isOriginAllowed = !origin || ALLOWED_ORIGINS.includes(origin);
      if (!isOriginAllowed) {
        return new Response("Forbidden", { status: 403 });
      }
      const upgraded = server.upgrade(req, { data: { todoId } });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      return undefined as unknown as Response;
    }

    return jsonResponse({ ok: false, message: "Not found" }, 404, origin);
  },

  websocket: {
    async open(ws) {
      const { todoId } = ws.data as { todoId: string };
      console.log(`[ws] open todoId=${todoId}`);
      try {
        // ワークスペース情報からCWDを取得（1.5秒タイムアウトで必ずPTY生成に進む）
        const config = loadAgentConfig();
        let cwd = homedir();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        try {
          const res = await fetch(`http://localhost:8787/api/todos/${todoId}/workspace`, {
            headers: { Authorization: `Bearer ${config.apiToken}` },
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json() as { workspace?: { paths?: { path: string }[] } };
            const firstPath = data.workspace?.paths?.[0]?.path;
            if (firstPath) cwd = firstPath;
          }
        } catch (e) {
          console.warn(`[ws] workspace fetch失敗 (fallback $HOME):`, String(e));
        } finally {
          clearTimeout(timeout);
        }
        const session = getOrCreateSession(todoId, cwd);
        attachClient(todoId, ws, session);
        console.log(`[ws] attached todoId=${todoId} pid=${session.proc.pid} cwd=${session.cwd}`);
      } catch (err) {
        console.error(`[ws] open error todoId=${todoId}:`, err);
        ws.send(JSON.stringify({ type: "error", message: String(err) }));
        ws.close();
      }
    },

    message(ws, message) {
      const { todoId } = ws.data as { todoId: string };
      try {
        const msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message as BufferSource)) as { type: string; data?: string; cols?: number; rows?: number };
        if (msg.type === "input" && typeof msg.data === "string") {
          writeInput(todoId, msg.data);
        } else if (msg.type === "resize" && msg.cols && msg.rows) {
          resizePty(todoId, msg.cols, msg.rows);
        }
      } catch {
        // ignore parse errors
      }
    },

    close(ws) {
      const { todoId } = ws.data as { todoId: string };
      detachClient(todoId, ws);
    },
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

process.on("exit", destroyAllSessions);
process.on("SIGINT", () => { destroyAllSessions(); process.exit(0); });
process.on("SIGTERM", () => { destroyAllSessions(); process.exit(0); });
