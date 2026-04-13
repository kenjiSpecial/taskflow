import { Type, type Tool } from "@mariozechner/pi-ai";

// Taskflow API操作用のツール定義

export const agentTools: Tool[] = [
  {
    name: "list_todos",
    description:
      "タスク一覧を取得。status, project_id, priority, tag等でフィルタ可能。",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({ description: "backlog | todo | in_progress | review | done" }),
      ),
      project_id: Type.Optional(Type.String({ description: "プロジェクトID" })),
      priority: Type.Optional(
        Type.String({ description: "high | medium | low" }),
      ),
      limit: Type.Optional(Type.Number({ description: "取得件数（デフォルト50）" })),
    }),
  },
  {
    name: "get_todo",
    description: "タスクの詳細を取得。子タスクやタグ情報も含まれる。",
    parameters: Type.Object({
      id: Type.String({ description: "タスクID" }),
    }),
  },
  {
    name: "create_todo",
    description: "新しいタスクを作成。",
    parameters: Type.Object({
      title: Type.String({ description: "タスクのタイトル" }),
      description: Type.Optional(Type.String({ description: "タスクの詳細説明" })),
      priority: Type.Optional(
        Type.String({ description: "high | medium | low（デフォルト: medium）" }),
      ),
      project_id: Type.Optional(Type.String({ description: "プロジェクトID" })),
      due_date: Type.Optional(
        Type.String({ description: "期限日（YYYY-MM-DD形式）" }),
      ),
      parent_id: Type.Optional(Type.String({ description: "親タスクID（子タスク作成時）" })),
    }),
  },
  {
    name: "update_todo",
    description: "既存タスクを更新。ステータス変更、タイトル変更等。",
    parameters: Type.Object({
      id: Type.String({ description: "タスクID" }),
      title: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      status: Type.Optional(
        Type.String({ description: "backlog | todo | in_progress | review | done" }),
      ),
      priority: Type.Optional(Type.String({ description: "high | medium | low" })),
      project_id: Type.Optional(Type.String()),
      due_date: Type.Optional(Type.String()),
    }),
  },
  {
    name: "delete_todo",
    description: "タスクを削除（論理削除）。この操作は破壊的です。",
    parameters: Type.Object({
      id: Type.String({ description: "削除するタスクID" }),
    }),
  },
  {
    name: "get_todays_todos",
    description: "今日が期限のタスク一覧を取得。",
    parameters: Type.Object({
      timezone: Type.Optional(
        Type.String({ description: "タイムゾーン（デフォルト: Asia/Tokyo）" }),
      ),
    }),
  },
  {
    name: "list_projects",
    description: "プロジェクト一覧を取得。",
    parameters: Type.Object({
      limit: Type.Optional(Type.Number({ description: "取得件数" })),
    }),
  },
  {
    name: "get_project",
    description: "プロジェクトの詳細を取得。",
    parameters: Type.Object({
      id: Type.String({ description: "プロジェクトID" }),
    }),
  },
  {
    name: "create_project",
    description: "新しいプロジェクトを作成。",
    parameters: Type.Object({
      name: Type.String({ description: "プロジェクト名" }),
      description: Type.Optional(Type.String()),
      color: Type.Optional(Type.String({ description: "カラーコード（例: #ff6b6b）" })),
    }),
  },
  {
    name: "update_project",
    description: "既存プロジェクトを更新。",
    parameters: Type.Object({
      id: Type.String({ description: "プロジェクトID" }),
      name: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      color: Type.Optional(Type.String()),
    }),
  },
  {
    name: "delete_project",
    description: "プロジェクトを削除（論理削除）。この操作は破壊的です。",
    parameters: Type.Object({
      id: Type.String({ description: "削除するプロジェクトID" }),
    }),
  },
  {
    name: "list_sessions",
    description: "作業セッション一覧を取得。status, project_idでフィルタ可能。",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({ description: "active | paused | done" }),
      ),
      project_id: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Number()),
    }),
  },
  {
    name: "create_session",
    description: "新しい作業セッションを作成。",
    parameters: Type.Object({
      title: Type.String({ description: "セッションタイトル" }),
      description: Type.Optional(Type.String()),
      project_id: Type.Optional(Type.String()),
    }),
  },
  {
    name: "update_session",
    description: "作業セッションを更新。ステータス変更等。",
    parameters: Type.Object({
      id: Type.String({ description: "セッションID" }),
      title: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      status: Type.Optional(
        Type.String({ description: "active | paused | done" }),
      ),
    }),
  },
  {
    name: "delete_session",
    description: "セッションを削除（論理削除）。この操作は破壊的です。",
    parameters: Type.Object({
      id: Type.String({ description: "削除するセッションID" }),
    }),
  },
  {
    name: "get_session_tasks",
    description: "セッションにリンクされたタスク一覧を取得。",
    parameters: Type.Object({
      session_id: Type.String({ description: "セッションID" }),
    }),
  },
  {
    name: "link_task_to_session",
    description: "タスクをセッションにリンク（紐付け）する。",
    parameters: Type.Object({
      session_id: Type.String({ description: "セッションID" }),
      todo_id: Type.String({ description: "タスクID" }),
    }),
  },
  {
    name: "unlink_task_from_session",
    description: "タスクのセッションへのリンクを解除する。この操作は破壊的です。",
    parameters: Type.Object({
      session_id: Type.String({ description: "セッションID" }),
      todo_id: Type.String({ description: "タスクID" }),
    }),
  },
  {
    name: "list_todo_logs",
    description: "タスクのログ一覧を取得。作業メモや進捗記録を時系列で表示。",
    parameters: Type.Object({
      todo_id: Type.String({ description: "タスクID" }),
      limit: Type.Optional(Type.Number({ description: "取得件数（デフォルト50）" })),
    }),
  },
  {
    name: "add_todo_log",
    description: "タスクにログ（作業メモ）を追加。Markdown対応。エージェント経由の場合source=aiを指定。",
    parameters: Type.Object({
      todo_id: Type.String({ description: "タスクID" }),
      content: Type.String({ description: "ログ内容（Markdown対応）" }),
      source: Type.Optional(Type.String({ description: "human | ai（デフォルト: human）。エージェント経由ならai" })),
    }),
  },
  {
    name: "list_tags",
    description: "タグ一覧を取得。",
    parameters: Type.Object({}),
  },
  {
    name: "create_tag",
    description: "新しいタグを作成。",
    parameters: Type.Object({
      name: Type.String({ description: "タグ名" }),
      color: Type.Optional(Type.String({ description: "カラーコード" })),
    }),
  },
];

// 破壊的操作のツール名リスト
export const destructiveTools = new Set([
  "delete_todo",
  "delete_project",
  "delete_session",
  "unlink_task_from_session",
]);

// ツール名→API呼び出しのマッピング
interface ToolApiMapping {
  method: string;
  path: (args: Record<string, unknown>) => string;
  body?: (args: Record<string, unknown>) => Record<string, unknown> | undefined;
  queryParams?: (args: Record<string, unknown>) => Record<string, string>;
}

export const toolApiMap: Record<string, ToolApiMapping> = {
  list_todos: {
    method: "GET",
    path: () => "/api/todos",
    queryParams: (args) => {
      const params: Record<string, string> = {};
      if (args.status) params.status = String(args.status);
      if (args.project_id) params.project_id = String(args.project_id);
      if (args.priority) params.priority = String(args.priority);
      if (args.limit) params.limit = String(args.limit);
      return params;
    },
  },
  get_todo: {
    method: "GET",
    path: (args) => `/api/todos/${args.id}`,
  },
  create_todo: {
    method: "POST",
    path: () => "/api/todos",
    body: ({ title, description, priority, project_id, due_date, parent_id }) => ({
      title,
      ...(description && { description }),
      ...(priority && { priority }),
      ...(project_id && { project_id }),
      ...(due_date && { due_date }),
      ...(parent_id && { parent_id }),
    }),
  },
  update_todo: {
    method: "PATCH",
    path: (args) => `/api/todos/${args.id}`,
    body: ({ title, description, status, priority, project_id, due_date }) => {
      const b: Record<string, unknown> = {};
      if (title !== undefined) b.title = title;
      if (description !== undefined) b.description = description;
      if (status !== undefined) b.status = status;
      if (priority !== undefined) b.priority = priority;
      if (project_id !== undefined) b.project_id = project_id;
      if (due_date !== undefined) b.due_date = due_date;
      return b;
    },
  },
  delete_todo: {
    method: "DELETE",
    path: (args) => `/api/todos/${args.id}`,
  },
  get_todays_todos: {
    method: "GET",
    path: () => "/api/todos/today",
    queryParams: (args) => {
      const params: Record<string, string> = {};
      if (args.timezone) params.timezone = String(args.timezone);
      return params;
    },
  },
  list_projects: {
    method: "GET",
    path: () => "/api/projects",
    queryParams: (args) => {
      const params: Record<string, string> = {};
      if (args.limit) params.limit = String(args.limit);
      return params;
    },
  },
  get_project: {
    method: "GET",
    path: (args) => `/api/projects/${args.id}`,
  },
  create_project: {
    method: "POST",
    path: () => "/api/projects",
    body: ({ name, description, color }) => ({
      name,
      ...(description && { description }),
      ...(color && { color }),
    }),
  },
  update_project: {
    method: "PATCH",
    path: (args) => `/api/projects/${args.id}`,
    body: ({ name, description, color }) => {
      const b: Record<string, unknown> = {};
      if (name !== undefined) b.name = name;
      if (description !== undefined) b.description = description;
      if (color !== undefined) b.color = color;
      return b;
    },
  },
  delete_project: {
    method: "DELETE",
    path: (args) => `/api/projects/${args.id}`,
  },
  list_sessions: {
    method: "GET",
    path: () => "/api/sessions",
    queryParams: (args) => {
      const params: Record<string, string> = {};
      if (args.status) params.status = String(args.status);
      if (args.project_id) params.project_id = String(args.project_id);
      if (args.limit) params.limit = String(args.limit);
      return params;
    },
  },
  create_session: {
    method: "POST",
    path: () => "/api/sessions",
    body: ({ title, description, project_id }) => ({
      title,
      ...(description && { description }),
      ...(project_id && { project_id }),
    }),
  },
  update_session: {
    method: "PATCH",
    path: (args) => `/api/sessions/${args.id}`,
    body: ({ title, description, status }) => {
      const b: Record<string, unknown> = {};
      if (title !== undefined) b.title = title;
      if (description !== undefined) b.description = description;
      if (status !== undefined) b.status = status;
      return b;
    },
  },
  delete_session: {
    method: "DELETE",
    path: (args) => `/api/sessions/${args.id}`,
  },
  get_session_tasks: {
    method: "GET",
    path: (args) => `/api/sessions/${args.session_id}/tasks`,
  },
  link_task_to_session: {
    method: "POST",
    path: (args) => `/api/sessions/${args.session_id}/tasks`,
    body: ({ todo_id }) => ({ todo_id }),
  },
  unlink_task_from_session: {
    method: "DELETE",
    path: (args) => `/api/sessions/${args.session_id}/tasks/${args.todo_id}`,
  },
  list_todo_logs: {
    method: "GET",
    path: (args) => `/api/todos/${args.todo_id}/logs`,
    queryParams: (args) => {
      const params: Record<string, string> = {};
      if (args.limit) params.limit = String(args.limit);
      return params;
    },
  },
  add_todo_log: {
    method: "POST",
    path: (args) => `/api/todos/${args.todo_id}/logs`,
    body: ({ content, source }) => ({
      content,
      ...(source && { source }),
    }),
  },
  list_tags: {
    method: "GET",
    path: () => "/api/tags",
  },
  create_tag: {
    method: "POST",
    path: () => "/api/tags",
    body: ({ name, color }) => ({
      name,
      ...(color && { color }),
    }),
  },
};
