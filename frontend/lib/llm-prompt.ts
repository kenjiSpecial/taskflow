import type { Todo, Project, WorkSession, SessionLog } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  review: "Review",
  ready_for_publish: "公開待ち",
  done: "Done",
  active: "Active",
  paused: "Paused",
};

function formatDate(date: string | null): string {
  if (!date) return "なし";
  return new Date(date).toLocaleDateString("ja-JP");
}

function checkbox(status: string): string {
  return status === "done" ? "[x]" : "[ ]";
}

// --- Task Prompt ---

export function generateTaskPrompt(
  todo: Todo,
  children?: Todo[],
  sessions?: WorkSession[]
): string {
  const lines: string[] = [];

  lines.push(`# タスク: ${todo.title}`);
  lines.push("");
  lines.push(`- ステータス: ${STATUS_LABELS[todo.status] ?? todo.status}`);
  lines.push(`- 優先度: ${todo.priority}`);
  lines.push(`- プロジェクト: ${todo.project ?? "なし"}`);
  lines.push(`- 期日: ${formatDate(todo.due_date)}`);

  if (todo.tags && todo.tags.length > 0) {
    lines.push(`- タグ: ${todo.tags.map((t) => t.name).join(", ")}`);
  }

  if (todo.description) {
    lines.push("");
    lines.push("## 説明");
    lines.push("");
    lines.push(todo.description);
  }

  if (children && children.length > 0) {
    lines.push("");
    lines.push("## サブタスク");
    lines.push("");
    for (const child of children) {
      lines.push(
        `- ${checkbox(child.status)} ${child.title} (${STATUS_LABELS[child.status] ?? child.status})`
      );
    }
  }

  if (sessions && sessions.length > 0) {
    lines.push("");
    lines.push("## リンク中のセッション");
    lines.push("");
    for (const session of sessions) {
      const statusLabel = STATUS_LABELS[session.status] ?? session.status;
      const latestLog =
        session.recent_logs && session.recent_logs.length > 0
          ? session.recent_logs[0].content
          : "ログなし";
      lines.push(`- ${session.title} (${statusLabel}) - 最新ログ: ${latestLog}`);
    }
  }

  return lines.join("\n");
}

// --- Project Prompt ---

export function generateProjectPrompt(
  project: Project,
  todos: Todo[],
  sessions?: WorkSession[]
): string {
  const lines: string[] = [];

  lines.push(`# プロジェクト: ${project.name}`);
  lines.push("");

  if (project.description) {
    lines.push(`> ${project.description}`);
    lines.push("");
  }

  // Status summary
  const statusCounts: Record<string, number> = {};
  for (const todo of todos) {
    statusCounts[todo.status] = (statusCounts[todo.status] ?? 0) + 1;
  }

  lines.push("## タスク状況サマリ");
  lines.push("");
  for (const [status, count] of Object.entries(statusCounts)) {
    lines.push(`- ${STATUS_LABELS[status] ?? status}: ${count}件`);
  }
  lines.push(`- 合計: ${todos.length}件`);

  // Active tasks detail
  const activeTodos = todos.filter((t) => t.status !== "done" && t.status !== "backlog");
  if (activeTodos.length > 0) {
    lines.push("");
    lines.push("## アクティブなタスク");
    lines.push("");
    for (const todo of activeTodos) {
      lines.push(
        `- ${checkbox(todo.status)} ${todo.title} (${STATUS_LABELS[todo.status] ?? todo.status}, ${todo.priority})`
      );
    }
  }

  if (sessions && sessions.length > 0) {
    lines.push("");
    lines.push("## セッション");
    lines.push("");
    for (const session of sessions) {
      const statusLabel = STATUS_LABELS[session.status] ?? session.status;
      lines.push(
        `- ${session.title} (${statusLabel}) - タスク: ${session.task_completed}/${session.task_total}完了`
      );
    }
  }

  return lines.join("\n");
}

// --- Session Prompt ---

export function generateSessionPrompt(
  session: WorkSession,
  tasks?: Todo[],
  logs?: SessionLog[]
): string {
  const lines: string[] = [];

  lines.push(`# セッション: ${session.title}`);
  lines.push("");
  lines.push(`- ステータス: ${STATUS_LABELS[session.status] ?? session.status}`);
  lines.push(`- プロジェクト: ${session.project ?? "なし"}`);
  lines.push(`- 開始: ${formatDate(session.created_at)}`);

  if (session.description) {
    lines.push("");
    lines.push("## 説明");
    lines.push("");
    lines.push(session.description);
  }

  if (tasks && tasks.length > 0) {
    lines.push("");
    lines.push("## リンクされたタスク");
    lines.push("");
    for (const task of tasks) {
      lines.push(
        `- ${checkbox(task.status)} ${task.title} (${STATUS_LABELS[task.status] ?? task.status}, ${task.priority})`
      );
    }
  }

  if (logs && logs.length > 0) {
    lines.push("");
    lines.push("## ログ (時系列)");
    lines.push("");
    for (const log of logs) {
      const time = new Date(log.created_at).toLocaleString("ja-JP");
      lines.push(`### ${time}`);
      lines.push("");
      lines.push(log.content);
      lines.push("");
    }
  }

  return lines.join("\n");
}
