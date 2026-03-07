#!/usr/bin/env bun

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ─── Constants ──────────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), ".taskflow-cmux");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const PROFILES_DIR = join(CONFIG_DIR, "profiles");
const DEFAULT_API_URL = "https://taskflow.kenji-draemon.workers.dev";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_TOKENS = 1000;

const MAX_TASKS = 10;
const MAX_LOGS = 3;
const MAX_LOG_CHARS = 500;
const MAX_PROFILE_CHARS = 5000;

const GUARDRAILS = `
---
上記の情報を確認し、指示を待ってください。
指示があるまで実行や変更は行わないでください。
不明な点があれば、必ず質問してください。
ファイルの削除は提案のみ行い、実行しないでください。
`.trim();

const META_PROMPT = `あなたはClaude Codeワークスペースの初期プロンプトを生成するアシスタントです。
以下の情報をもとに、Claude Codeが効果的に作業を開始できる簡潔なプロンプトを日本語で生成してください。

要件:
- セッションの目的・背景を1-2文で説明
- プロジェクトの役割（プロファイルがある場合はそれに従う）を簡潔に記述
- リンク済みタスクを優先度順にリスト
- 前回の作業ログがあれば「前回の続き」として要約
- 全体で300-500文字程度に収める
- ガードレール文言は含めない（別途追加される）
- マークダウン形式で出力`;

// ─── Types ──────────────────────────────────────────────────────────────────

interface Config {
  apiUrl: string;
  apiToken: string;
  openrouterApiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
}

interface SessionData {
  session: {
    title: string;
    description: string | null;
    status: string;
    project: string | null;
    project_id: string | null;
  };
}

interface Task {
  title: string;
  description: string | null;
  status: string;
  priority: string;
}

interface Log {
  content: string;
  created_at: string;
}

interface ProjectData {
  project: {
    name: string;
    description: string | null;
    directory_path: string | null;
  };
}

// ─── Config ─────────────────────────────────────────────────────────────────

function loadConfig(): Config {
  let fileConfig: Record<string, unknown> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    } catch {
      // ignore parse errors
    }
  }

  const apiUrl =
    process.env.TASKFLOW_API_URL ||
    (fileConfig.api_url as string) ||
    DEFAULT_API_URL;

  const apiToken =
    process.env.TASKFLOW_API_TOKEN ||
    (fileConfig.api_token as string) ||
    "";

  const openrouterApiKey =
    process.env.OPENROUTER_API_KEY ||
    (fileConfig.openrouter_api_key as string) ||
    "";

  const pgConfig = (fileConfig.prompt_generator as Record<string, unknown>) || {};

  return {
    apiUrl,
    apiToken,
    openrouterApiKey,
    model: (pgConfig.model as string) || DEFAULT_MODEL,
    timeoutMs: (pgConfig.timeout_ms as number) || DEFAULT_TIMEOUT_MS,
    maxTokens: (pgConfig.max_tokens as number) || DEFAULT_MAX_TOKENS,
  };
}

// ─── API Helpers ────────────────────────────────────────────────────────────

async function apiGet<T>(config: Config, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

async function fetchSessionData(config: Config, sessionId: string) {
  const [sessionRes, tasksRes, logsRes] = await Promise.all([
    apiGet<SessionData>(config, `/api/sessions/${sessionId}`),
    apiGet<{ tasks: Task[] }>(config, `/api/sessions/${sessionId}/tasks`),
    apiGet<{ logs: Log[] }>(config, `/api/sessions/${sessionId}/logs?order=desc&limit=${MAX_LOGS}`),
  ]);

  if (!sessionRes) return null;

  let project: ProjectData["project"] | null = null;
  if (sessionRes.session.project_id) {
    const projRes = await apiGet<ProjectData>(config, `/api/projects/${sessionRes.session.project_id}`);
    if (projRes) project = projRes.project;
  }

  // Sort tasks by priority, limit to MAX_TASKS
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const tasks = (tasksRes?.tasks || [])
    .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
    .slice(0, MAX_TASKS);

  // Truncate log content
  const logs = (logsRes?.logs || []).map((log) => ({
    ...log,
    content: log.content.length > MAX_LOG_CHARS
      ? log.content.slice(0, MAX_LOG_CHARS) + "..."
      : log.content,
  }));

  return {
    session: sessionRes.session,
    tasks,
    logs,
    project,
  };
}

// ─── Profile Loading ────────────────────────────────────────────────────────

function loadProfile(projectName: string | null): string | null {
  if (!projectName || !existsSync(PROFILES_DIR)) return null;

  // 1. Exact match
  const exactPath = join(PROFILES_DIR, `${projectName}.md`);
  if (existsSync(exactPath)) {
    return truncate(readFileSync(exactPath, "utf-8"), MAX_PROFILE_CHARS);
  }

  // 2. Normalized match (lowercase, spaces → underscores)
  const normalized = projectName.toLowerCase().replace(/\s+/g, "_");
  try {
    const files = readdirSync(PROFILES_DIR);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const name = file.slice(0, -3).toLowerCase().replace(/\s+/g, "_");
      if (name === normalized) {
        return truncate(readFileSync(join(PROFILES_DIR, file), "utf-8"), MAX_PROFILE_CHARS);
      }
    }
  } catch {
    // ignore
  }

  return null;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "\n..." : text;
}

// ─── Context Building ───────────────────────────────────────────────────────

function buildContext(data: NonNullable<Awaited<ReturnType<typeof fetchSessionData>>>, profile: string | null): string {
  const parts: string[] = [];

  // Session info
  parts.push(`## セッション情報`);
  parts.push(`- タイトル: ${data.session.title}`);
  if (data.session.description) {
    parts.push(`- 概要: ${data.session.description}`);
  }

  // Project info
  if (data.project) {
    parts.push(`\n## プロジェクト`);
    parts.push(`- 名前: ${data.project.name}`);
    if (data.project.description) {
      parts.push(`- 説明: ${data.project.description}`);
    }
    if (data.project.directory_path) {
      parts.push(`- 作業ディレクトリ: ${data.project.directory_path}`);
    }
  }

  // Profile
  if (profile) {
    parts.push(`\n## プロジェクトプロファイル（役割定義）`);
    parts.push(profile);
  }

  // Tasks
  if (data.tasks.length > 0) {
    parts.push(`\n## リンク済みタスク (${data.tasks.length}件)`);
    for (const task of data.tasks) {
      const status = task.status === "completed" ? "完了" : task.status === "in_progress" ? "進行中" : "未着手";
      const priority = task.priority === "high" ? "高" : task.priority === "low" ? "低" : "中";
      parts.push(`- [${priority}][${status}] ${task.title}`);
      if (task.description) {
        const desc = task.description.length > 200
          ? task.description.slice(0, 200) + "..."
          : task.description;
        parts.push(`  ${desc}`);
      }
    }
  }

  // Logs
  if (data.logs.length > 0) {
    parts.push(`\n## 前回の作業ログ`);
    for (const log of data.logs) {
      const date = new Date(log.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      parts.push(`- ${date}: ${log.content}`);
    }
  }

  return parts.join("\n");
}

// ─── LLM Generation ────────────────────────────────────────────────────────

async function generatePrompt(config: Config, context: string): Promise<string | null> {
  if (!config.openrouterApiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: META_PROMPT },
          { role: "user", content: context },
        ],
        max_tokens: config.maxTokens,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`OpenRouter API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("OpenRouter API timeout");
    } else {
      console.error(`OpenRouter API error: ${err}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Parse args
  const sessionIdIndex = process.argv.indexOf("--session-id");
  if (sessionIdIndex === -1 || !process.argv[sessionIdIndex + 1]) {
    console.error("Usage: prompt-generator.ts --session-id <session-id>");
    process.exit(1);
  }
  const sessionId = process.argv[sessionIdIndex + 1];

  // Load config
  const config = loadConfig();
  if (!config.apiToken) {
    console.error("API token not configured");
    process.exit(1);
  }

  // Fetch data
  const data = await fetchSessionData(config, sessionId);
  if (!data) {
    console.error("Failed to fetch session data");
    process.exit(1);
  }

  // Load profile
  const profile = loadProfile(data.session.project || data.project?.name || null);

  // Build context
  const context = buildContext(data, profile);

  // Generate prompt via LLM
  const generated = await generatePrompt(config, context);

  // Compose final output
  let output: string;
  if (generated) {
    output = generated;
  } else {
    // Fallback: use the context directly (structured but not LLM-refined)
    output = context;
  }

  // Append guardrails (static, never LLM-generated)
  output = `${output}\n\n${GUARDRAILS}`;

  process.stdout.write(output);
}

main().catch((err) => {
  console.error(`prompt-generator error: ${err}`);
  process.exit(1);
});
