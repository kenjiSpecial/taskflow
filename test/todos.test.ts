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

async function createTodo(body: Record<string, unknown>) {
  return SELF.fetch("http://localhost/api/todos", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("Todos CRUD", () => {
  it("TODO作成", async () => {
    const res = await createTodo({ title: "テストタスク" });
    expect(res.status).toBe(201);
    const data = await res.json() as { todo: { id: string; title: string; status: string; priority: string } };
    expect(data.todo.title).toBe("テストタスク");
    expect(data.todo.status).toBe("pending");
    expect(data.todo.priority).toBe("medium");
  });

  it("TODO一覧取得", async () => {
    await createTodo({ title: "一覧テスト" });
    const res = await SELF.fetch("http://localhost/api/todos", { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { todos: unknown[]; meta: { total: number } };
    expect(data.todos.length).toBeGreaterThan(0);
    expect(data.meta.total).toBeGreaterThan(0);
  });

  it("TODO詳細取得", async () => {
    const createRes = await createTodo({ title: "詳細テスト" });
    const created = await createRes.json() as { todo: { id: string } };

    const res = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { todo: { id: string; title: string; children: unknown[] } };
    expect(data.todo.title).toBe("詳細テスト");
    expect(data.todo.children).toEqual([]);
  });

  it("TODO更新", async () => {
    const createRes = await createTodo({ title: "更新前" });
    const created = await createRes.json() as { todo: { id: string } };

    const res = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "更新後", status: "completed" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { todo: { title: string; status: string; completed_at: string | null } };
    expect(data.todo.title).toBe("更新後");
    expect(data.todo.status).toBe("completed");
    expect(data.todo.completed_at).not.toBeNull();
  });

  it("TODO論理削除", async () => {
    const createRes = await createTodo({ title: "削除テスト" });
    const created = await createRes.json() as { todo: { id: string } };

    const deleteRes = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, {
      method: "DELETE",
      headers,
    });
    expect(deleteRes.status).toBe(200);

    const getRes = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, { headers });
    expect(getRes.status).toBe(404);
  });

  it("子タスク作成・親削除時に子も論理削除", async () => {
    const parentRes = await createTodo({ title: "親タスク" });
    const parent = await parentRes.json() as { todo: { id: string } };

    const childRes = await createTodo({ title: "子タスク", parent_id: parent.todo.id });
    expect(childRes.status).toBe(201);
    const child = await childRes.json() as { todo: { id: string } };

    await SELF.fetch(`http://localhost/api/todos/${parent.todo.id}`, { method: "DELETE", headers });

    const getChild = await SELF.fetch(`http://localhost/api/todos/${child.todo.id}`, { headers });
    expect(getChild.status).toBe(404);
  });

  it("孫タスク作成は拒否", async () => {
    const parentRes = await createTodo({ title: "親" });
    const parent = await parentRes.json() as { todo: { id: string } };

    const childRes = await createTodo({ title: "子", parent_id: parent.todo.id });
    const child = await childRes.json() as { todo: { id: string } };

    const grandchildRes = await createTodo({ title: "孫", parent_id: child.todo.id });
    expect(grandchildRes.status).toBe(400);
  });

  it("バリデーションエラー（タイトルなし）", async () => {
    const res = await createTodo({});
    expect(res.status).toBe(400);
  });

  it("フィルタ（ステータス）", async () => {
    await createTodo({ title: "フィルタ用", status: "in_progress" });
    const res = await SELF.fetch("http://localhost/api/todos?status=in_progress", { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { todos: { status: string }[] };
    for (const todo of data.todos) {
      expect(todo.status).toBe("in_progress");
    }
  });
});
