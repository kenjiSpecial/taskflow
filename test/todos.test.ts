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
    expect(data.todo.status).toBe("backlog");
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

  it("TODO更新（done）", async () => {
    const createRes = await createTodo({ title: "更新前" });
    const created = await createRes.json() as { todo: { id: string } };

    const res = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "更新後", status: "done" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { todo: { title: string; status: string; done_at: string | null } };
    expect(data.todo.title).toBe("更新後");
    expect(data.todo.status).toBe("done");
    expect(data.todo.done_at).not.toBeNull();
  });

  it("TODO更新（todo）", async () => {
    const createRes = await createTodo({ title: "todoステータステスト" });
    const created = await createRes.json() as { todo: { id: string } };

    const res = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "todo" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { todo: { status: string } };
    expect(data.todo.status).toBe("todo");
  });

  it("TODO更新（review）", async () => {
    const createRes = await createTodo({ title: "reviewステータステスト" });
    const created = await createRes.json() as { todo: { id: string } };

    const res = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "review" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { todo: { status: string } };
    expect(data.todo.status).toBe("review");
  });

  it("done→backlogに戻すとdone_atがクリアされる", async () => {
    const createRes = await createTodo({ title: "done戻しテスト" });
    const created = await createRes.json() as { todo: { id: string } };

    // まずdoneにする
    await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "done" }),
    });

    // backlogに戻す
    const res = await SELF.fetch(`http://localhost/api/todos/${created.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "backlog" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { todo: { status: string; done_at: string | null } };
    expect(data.todo.status).toBe("backlog");
    expect(data.todo.done_at).toBeNull();
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

  it("PATCH: parent_id自己参照は拒否", async () => {
    const res = await createTodo({ title: "自己参照テスト" });
    const todo = await res.json() as { todo: { id: string } };

    const patchRes = await SELF.fetch(`http://localhost/api/todos/${todo.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ parent_id: todo.todo.id }),
    });
    expect(patchRes.status).toBe(400);
  });

  it("PATCH: 子を孫にする（2階層超え）は拒否", async () => {
    const parentRes = await createTodo({ title: "PATCHテスト親" });
    const parent = await parentRes.json() as { todo: { id: string } };

    const childRes = await createTodo({ title: "PATCHテスト子", parent_id: parent.todo.id });
    const child = await childRes.json() as { todo: { id: string } };

    const otherChildRes = await createTodo({ title: "PATCHテスト他の子", parent_id: parent.todo.id });
    const otherChild = await otherChildRes.json() as { todo: { id: string } };

    // 子を他の子の子にしようとする → 拒否
    const patchRes = await SELF.fetch(`http://localhost/api/todos/${child.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ parent_id: otherChild.todo.id }),
    });
    expect(patchRes.status).toBe(400);
  });

  it("PATCH: 子持ちタスクを別タスクの子にするのは拒否", async () => {
    const parentRes = await createTodo({ title: "子持ち親" });
    const parent = await parentRes.json() as { todo: { id: string } };

    await createTodo({ title: "その子", parent_id: parent.todo.id });

    const otherRes = await createTodo({ title: "別のタスク" });
    const other = await otherRes.json() as { todo: { id: string } };

    // 子持ち親を別タスクの子にしようとする → 拒否
    const patchRes = await SELF.fetch(`http://localhost/api/todos/${parent.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ parent_id: other.todo.id }),
    });
    expect(patchRes.status).toBe(400);
  });

  it("PATCH: parent_idをnullに変更（トップレベルに戻す）", async () => {
    const parentRes = await createTodo({ title: "戻すテスト親" });
    const parent = await parentRes.json() as { todo: { id: string } };

    const childRes = await createTodo({ title: "戻すテスト子", parent_id: parent.todo.id });
    const child = await childRes.json() as { todo: { id: string } };

    const patchRes = await SELF.fetch(`http://localhost/api/todos/${child.todo.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ parent_id: null }),
    });
    expect(patchRes.status).toBe(200);
    const data = await patchRes.json() as { todo: { parent_id: string | null } };
    expect(data.todo.parent_id).toBeNull();
  });

  it("PATCH /reorder: 一括並び替え", async () => {
    const res1 = await createTodo({ title: "並び替えA", sort_order: 0 });
    const a = await res1.json() as { todo: { id: string } };
    const res2 = await createTodo({ title: "並び替えB", sort_order: 1 });
    const b = await res2.json() as { todo: { id: string } };

    const reorderRes = await SELF.fetch("http://localhost/api/todos/reorder", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        items: [
          { id: a.todo.id, sort_order: 1 },
          { id: b.todo.id, sort_order: 0 },
        ],
      }),
    });
    expect(reorderRes.status).toBe(200);

    // 確認
    const getA = await SELF.fetch(`http://localhost/api/todos/${a.todo.id}`, { headers });
    const dataA = await getA.json() as { todo: { sort_order: number } };
    expect(dataA.todo.sort_order).toBe(1);
  });

  it("PATCH /reorder: 空配列は拒否", async () => {
    const res = await SELF.fetch("http://localhost/api/todos/reorder", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ items: [] }),
    });
    expect(res.status).toBe(400);
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

  it("フィルタ（backlogステータス）", async () => {
    await createTodo({ title: "backlogフィルタ用" });
    const res = await SELF.fetch("http://localhost/api/todos?status=backlog", { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { todos: { status: string }[] };
    for (const todo of data.todos) {
      expect(todo.status).toBe("backlog");
    }
  });
});
