import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations } from "./helpers";

beforeAll(async () => {
  await applyMigrations();
});

const headers = {
  Authorization: "Bearer test-token",
  "Content-Type": "application/json",
};

async function createSession(body: Record<string, unknown>) {
  return SELF.fetch("http://localhost/api/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function createLog(sessionId: string, body: Record<string, unknown>) {
  return SELF.fetch(`http://localhost/api/sessions/${sessionId}/logs`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("Sessions CRUD", () => {
  it("セッション作成", async () => {
    const res = await createSession({ title: "テストセッション" });
    expect(res.status).toBe(201);
    const data = await res.json() as { session: { id: string; title: string; status: string } };
    expect(data.session.title).toBe("テストセッション");
    expect(data.session.status).toBe("active");
  });

  it("セッション作成（全フィールド）", async () => {
    const res = await createSession({
      title: "フルセッション",
      description: "詳細説明",
      project: "taskflow",
      status: "paused",
    });
    expect(res.status).toBe(201);
    const data = await res.json() as { session: { title: string; description: string; project: string; status: string } };
    expect(data.session.description).toBe("詳細説明");
    expect(data.session.project).toBe("taskflow");
    expect(data.session.status).toBe("paused");
  });

  it("セッション一覧取得", async () => {
    await createSession({ title: "一覧テスト" });
    const res = await SELF.fetch("http://localhost/api/sessions", { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { sessions: unknown[]; meta: { total: number } };
    expect(data.sessions.length).toBeGreaterThan(0);
    expect(data.meta.total).toBeGreaterThan(0);
  });

  it("セッション一覧フィルタ（ステータス）", async () => {
    await createSession({ title: "アクティブ", status: "active" });
    const res = await SELF.fetch("http://localhost/api/sessions?status=active", { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { sessions: { status: string }[] };
    for (const session of data.sessions) {
      expect(session.status).toBe("active");
    }
  });

  it("セッション詳細取得", async () => {
    const createRes = await createSession({ title: "詳細テスト" });
    const created = await createRes.json() as { session: { id: string } };

    const res = await SELF.fetch(`http://localhost/api/sessions/${created.session.id}`, { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { session: { id: string; title: string; recent_logs: unknown[] } };
    expect(data.session.title).toBe("詳細テスト");
    expect(data.session.recent_logs).toEqual([]);
  });

  it("セッション更新", async () => {
    const createRes = await createSession({ title: "更新前" });
    const created = await createRes.json() as { session: { id: string } };

    const res = await SELF.fetch(`http://localhost/api/sessions/${created.session.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "更新後", status: "paused" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { session: { title: string; status: string } };
    expect(data.session.title).toBe("更新後");
    expect(data.session.status).toBe("paused");
  });

  it("セッション論理削除", async () => {
    const createRes = await createSession({ title: "削除テスト" });
    const created = await createRes.json() as { session: { id: string } };

    const deleteRes = await SELF.fetch(`http://localhost/api/sessions/${created.session.id}`, {
      method: "DELETE",
      headers,
    });
    expect(deleteRes.status).toBe(200);

    const getRes = await SELF.fetch(`http://localhost/api/sessions/${created.session.id}`, { headers });
    expect(getRes.status).toBe(404);
  });

  it("存在しないセッション取得は404", async () => {
    const res = await SELF.fetch("http://localhost/api/sessions/nonexistent", { headers });
    expect(res.status).toBe(404);
  });

  it("バリデーションエラー（タイトルなし）", async () => {
    const res = await createSession({});
    expect(res.status).toBe(400);
  });
});

describe("Session Logs", () => {
  it("ログ追加", async () => {
    const sessionRes = await createSession({ title: "ログテスト" });
    const session = await sessionRes.json() as { session: { id: string } };

    const res = await createLog(session.session.id, { content: "作業メモ" });
    expect(res.status).toBe(201);
    const data = await res.json() as { log: { id: string; content: string; source: string; session_id: string } };
    expect(data.log.content).toBe("作業メモ");
    expect(data.log.source).toBe("ui");
    expect(data.log.session_id).toBe(session.session.id);
  });

  it("ログ追加（CLI経由）", async () => {
    const sessionRes = await createSession({ title: "CLIテスト" });
    const session = await sessionRes.json() as { session: { id: string } };

    const res = await createLog(session.session.id, { content: "CLIからのメモ", source: "cli" });
    expect(res.status).toBe(201);
    const data = await res.json() as { log: { source: string } };
    expect(data.log.source).toBe("cli");
  });

  it("ログ一覧取得（古い順）", async () => {
    const sessionRes = await createSession({ title: "ログ一覧テスト" });
    const session = await sessionRes.json() as { session: { id: string } };

    await createLog(session.session.id, { content: "1つ目" });
    await createLog(session.session.id, { content: "2つ目" });

    const res = await SELF.fetch(`http://localhost/api/sessions/${session.session.id}/logs`, { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { logs: { content: string }[]; meta: { total: number } };
    expect(data.logs.length).toBe(2);
    expect(data.meta.total).toBe(2);
    expect(data.logs[0].content).toBe("1つ目");
    expect(data.logs[1].content).toBe("2つ目");
  });

  it("done状態セッションへのログ追加は403", async () => {
    const sessionRes = await createSession({ title: "完了テスト" });
    const session = await sessionRes.json() as { session: { id: string } };

    await SELF.fetch(`http://localhost/api/sessions/${session.session.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "done" }),
    });

    const res = await createLog(session.session.id, { content: "追加不可" });
    expect(res.status).toBe(403);
  });

  it("paused状態セッションへのログ追加は許可", async () => {
    const sessionRes = await createSession({ title: "一時停止テスト", status: "paused" });
    const session = await sessionRes.json() as { session: { id: string } };

    const res = await createLog(session.session.id, { content: "一時停止中のメモ" });
    expect(res.status).toBe(201);
  });

  it("削除済みセッションへのログ追加は404", async () => {
    const sessionRes = await createSession({ title: "削除後テスト" });
    const session = await sessionRes.json() as { session: { id: string } };

    await SELF.fetch(`http://localhost/api/sessions/${session.session.id}`, {
      method: "DELETE",
      headers,
    });

    const res = await createLog(session.session.id, { content: "追加不可" });
    expect(res.status).toBe(404);
  });

  it("ログ内容が空はバリデーションエラー", async () => {
    const sessionRes = await createSession({ title: "空ログテスト" });
    const session = await sessionRes.json() as { session: { id: string } };

    const res = await createLog(session.session.id, { content: "" });
    expect(res.status).toBe(400);
  });

  it("セッション詳細に最新ログ3件が含まれる", async () => {
    const sessionRes = await createSession({ title: "最新ログテスト" });
    const session = await sessionRes.json() as { session: { id: string } };

    await createLog(session.session.id, { content: "ログ1" });
    await createLog(session.session.id, { content: "ログ2" });
    await createLog(session.session.id, { content: "ログ3" });
    await createLog(session.session.id, { content: "ログ4" });

    const res = await SELF.fetch(`http://localhost/api/sessions/${session.session.id}`, { headers });
    const data = await res.json() as { session: { recent_logs: { content: string }[] } };
    expect(data.session.recent_logs.length).toBe(3);
  });
});

// ヘルパー: タスク作成
async function createTodo(body: Record<string, unknown>) {
  return SELF.fetch("http://localhost/api/todos", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function linkTask(sessionId: string, todoId: string) {
  return SELF.fetch(`http://localhost/api/sessions/${sessionId}/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ todo_id: todoId }),
  });
}

async function unlinkTask(sessionId: string, todoId: string) {
  return SELF.fetch(`http://localhost/api/sessions/${sessionId}/tasks/${todoId}`, {
    method: "DELETE",
    headers,
  });
}

describe("Session Tasks (Linking)", () => {
  it("タスクリンク成功（activeセッション）", async () => {
    const sRes = await createSession({ title: "リンクテスト" });
    const s = await sRes.json() as { session: { id: string } };
    const tRes = await createTodo({ title: "タスクA" });
    const t = await tRes.json() as { todo: { id: string } };

    const res = await linkTask(s.session.id, t.todo.id);
    expect(res.status).toBe(201);
    const data = await res.json() as { session_task: { session_id: string; todo_id: string } };
    expect(data.session_task.session_id).toBe(s.session.id);
    expect(data.session_task.todo_id).toBe(t.todo.id);
  });

  it("タスクリンク成功（pausedセッション）", async () => {
    const sRes = await createSession({ title: "一時停止リンク", status: "paused" });
    const s = await sRes.json() as { session: { id: string } };
    const tRes = await createTodo({ title: "タスクB" });
    const t = await tRes.json() as { todo: { id: string } };

    const res = await linkTask(s.session.id, t.todo.id);
    expect(res.status).toBe(201);
  });

  it("doneセッションへのリンクは403", async () => {
    const sRes = await createSession({ title: "完了リンク" });
    const s = await sRes.json() as { session: { id: string } };
    await SELF.fetch(`http://localhost/api/sessions/${s.session.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "done" }),
    });
    const tRes = await createTodo({ title: "タスクC" });
    const t = await tRes.json() as { todo: { id: string } };

    const res = await linkTask(s.session.id, t.todo.id);
    expect(res.status).toBe(403);
  });

  it("削除済みセッションへのリンクは404", async () => {
    const sRes = await createSession({ title: "削除リンク" });
    const s = await sRes.json() as { session: { id: string } };
    await SELF.fetch(`http://localhost/api/sessions/${s.session.id}`, { method: "DELETE", headers });
    const tRes = await createTodo({ title: "タスクD" });
    const t = await tRes.json() as { todo: { id: string } };

    const res = await linkTask(s.session.id, t.todo.id);
    expect(res.status).toBe(404);
  });

  it("存在しないタスクへのリンクは404", async () => {
    const sRes = await createSession({ title: "不明タスクリンク" });
    const s = await sRes.json() as { session: { id: string } };

    const res = await linkTask(s.session.id, "nonexistent");
    expect(res.status).toBe(404);
  });

  it("削除済みタスクへのリンクは404", async () => {
    const sRes = await createSession({ title: "削除タスクリンク" });
    const s = await sRes.json() as { session: { id: string } };
    const tRes = await createTodo({ title: "削除されるタスク" });
    const t = await tRes.json() as { todo: { id: string } };
    await SELF.fetch(`http://localhost/api/todos/${t.todo.id}`, { method: "DELETE", headers });

    const res = await linkTask(s.session.id, t.todo.id);
    expect(res.status).toBe(404);
  });

  it("重複リンクは409", async () => {
    const sRes = await createSession({ title: "重複テスト" });
    const s = await sRes.json() as { session: { id: string } };
    const tRes = await createTodo({ title: "重複タスク" });
    const t = await tRes.json() as { todo: { id: string } };

    await linkTask(s.session.id, t.todo.id);
    const res = await linkTask(s.session.id, t.todo.id);
    expect(res.status).toBe(409);
  });

  it("アンリンク成功", async () => {
    const sRes = await createSession({ title: "アンリンクテスト" });
    const s = await sRes.json() as { session: { id: string } };
    const tRes = await createTodo({ title: "アンリンクタスク" });
    const t = await tRes.json() as { todo: { id: string } };

    await linkTask(s.session.id, t.todo.id);
    const res = await unlinkTask(s.session.id, t.todo.id);
    expect(res.status).toBe(200);
  });

  it("存在しないリンクのアンリンクは404", async () => {
    const sRes = await createSession({ title: "不明アンリンク" });
    const s = await sRes.json() as { session: { id: string } };

    const res = await unlinkTask(s.session.id, "nonexistent");
    expect(res.status).toBe(404);
  });

  it("セッション詳細にlinked_tasksが含まれる", async () => {
    const sRes = await createSession({ title: "詳細リンクテスト" });
    const s = await sRes.json() as { session: { id: string } };
    const tRes = await createTodo({ title: "リンクされたタスク" });
    const t = await tRes.json() as { todo: { id: string } };

    await linkTask(s.session.id, t.todo.id);

    const res = await SELF.fetch(`http://localhost/api/sessions/${s.session.id}`, { headers });
    const data = await res.json() as { session: { linked_tasks: { id: string; title: string }[] } };
    expect(data.session.linked_tasks.length).toBe(1);
    expect(data.session.linked_tasks[0].title).toBe("リンクされたタスク");
  });

  it("セッション一覧にtask_total/task_completedが含まれる", async () => {
    const sRes = await createSession({ title: "進捗テスト" });
    const s = await sRes.json() as { session: { id: string } };
    const t1Res = await createTodo({ title: "未完了タスク" });
    const t1 = await t1Res.json() as { todo: { id: string } };
    const t2Res = await createTodo({ title: "完了タスク", status: "completed" });
    const t2 = await t2Res.json() as { todo: { id: string } };

    await linkTask(s.session.id, t1.todo.id);
    await linkTask(s.session.id, t2.todo.id);

    const res = await SELF.fetch("http://localhost/api/sessions", { headers });
    const data = await res.json() as { sessions: { id: string; task_total: number; task_completed: number }[] };
    const target = data.sessions.find(s2 => s2.id === s.session.id);
    expect(target?.task_total).toBe(2);
    expect(target?.task_completed).toBe(1);
  });

  it("リンク済みタスク一覧取得", async () => {
    const sRes = await createSession({ title: "タスク一覧テスト" });
    const s = await sRes.json() as { session: { id: string } };
    const tRes = await createTodo({ title: "一覧タスク" });
    const t = await tRes.json() as { todo: { id: string } };

    await linkTask(s.session.id, t.todo.id);

    const res = await SELF.fetch(`http://localhost/api/sessions/${s.session.id}/tasks`, { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { tasks: { id: string; title: string }[] };
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].title).toBe("一覧タスク");
  });

  it("タスクの関連セッション一覧取得", async () => {
    const sRes = await createSession({ title: "タスク→セッション" });
    const s = await sRes.json() as { session: { id: string } };
    const tRes = await createTodo({ title: "関連セッションタスク" });
    const t = await tRes.json() as { todo: { id: string } };

    await linkTask(s.session.id, t.todo.id);

    const res = await SELF.fetch(`http://localhost/api/todos/${t.todo.id}/sessions`, { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { sessions: { id: string; title: string }[] };
    expect(data.sessions.length).toBe(1);
    expect(data.sessions[0].title).toBe("タスク→セッション");
  });
});
