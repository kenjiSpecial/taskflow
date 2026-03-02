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

async function createTag(body: Record<string, unknown>) {
  return SELF.fetch("http://localhost/api/tags", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function createProject(body: Record<string, unknown>) {
  return SELF.fetch("http://localhost/api/projects", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function createTodo(body: Record<string, unknown>) {
  return SELF.fetch("http://localhost/api/todos", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("Tags CRUD", () => {
  it("プリセットタグが存在する", async () => {
    const res = await SELF.fetch("http://localhost/api/tags", { headers });
    expect(res.status).toBe(200);
    const data = await res.json() as { tags: { name: string; is_preset: number }[] };
    const names = data.tags.map((t) => t.name);
    expect(names).toContain("仕事");
    expect(names).toContain("プライベート");
    expect(names).toContain("学習");
    expect(names).toContain("副業");
  });

  it("カスタムタグ作成・重複チェック・更新・削除", async () => {
    // 作成
    const res1 = await createTag({ name: "テスト", color: "#FF0000" });
    expect(res1.status).toBe(201);
    const data1 = await res1.json() as { tag: { id: string; name: string; color: string; is_preset: number } };
    expect(data1.tag.name).toBe("テスト");
    expect(data1.tag.color).toBe("#FF0000");
    expect(data1.tag.is_preset).toBe(0);
    const tagId = data1.tag.id;

    // 重複チェック
    const res2 = await createTag({ name: "テスト" });
    expect(res2.status).toBe(409);

    // 更新
    const res3 = await SELF.fetch(`http://localhost/api/tags/${tagId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "更新済み", color: "#00FF00" }),
    });
    expect(res3.status).toBe(200);
    const data3 = await res3.json() as { tag: { name: string; color: string } };
    expect(data3.tag.name).toBe("更新済み");
    expect(data3.tag.color).toBe("#00FF00");

    // 削除
    const delRes = await SELF.fetch(`http://localhost/api/tags/${tagId}`, {
      method: "DELETE",
      headers,
    });
    expect(delRes.status).toBe(200);

    // 一覧に表示されない
    const listRes = await SELF.fetch("http://localhost/api/tags", { headers });
    const listData = await listRes.json() as { tags: { name: string }[] };
    expect(listData.tags.find((t) => t.name === "更新済み")).toBeUndefined();
  });
});

describe("Project-Tag linking", () => {
  it("タグ紐付け・一覧・紐付け解除", async () => {
    // プロジェクト作成
    const pRes = await createProject({ name: "タグテストPJ" });
    const pData = await pRes.json() as { project: { id: string } };
    const projectId = pData.project.id;

    // プリセットタグIDを取得
    const tagsRes = await SELF.fetch("http://localhost/api/tags", { headers });
    const tagsData = await tagsRes.json() as { tags: { id: string; name: string }[] };
    const tagId = tagsData.tags.find((t) => t.name === "仕事")!.id;

    // 紐付け
    const linkRes = await SELF.fetch(`http://localhost/api/projects/${projectId}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tag_id: tagId }),
    });
    expect(linkRes.status).toBe(201);

    // 重複紐付け
    const dupRes = await SELF.fetch(`http://localhost/api/projects/${projectId}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tag_id: tagId }),
    });
    expect(dupRes.status).toBe(409);

    // プロジェクトのタグ一覧
    const pTagsRes = await SELF.fetch(`http://localhost/api/projects/${projectId}/tags`, { headers });
    expect(pTagsRes.status).toBe(200);
    const pTagsData = await pTagsRes.json() as { tags: { name: string }[] };
    expect(pTagsData.tags.find((t) => t.name === "仕事")).toBeDefined();

    // プロジェクト一覧にタグ情報
    const listRes = await SELF.fetch("http://localhost/api/projects?include_archived=true", { headers });
    const listData = await listRes.json() as { projects: { id: string; tags: { name: string }[] }[] };
    const project = listData.projects.find((p) => p.id === projectId);
    expect(project).toBeDefined();
    expect(project!.tags.find((t) => t.name === "仕事")).toBeDefined();

    // 紐付け解除
    const unlinkRes = await SELF.fetch(`http://localhost/api/projects/${projectId}/tags/${tagId}`, {
      method: "DELETE",
      headers,
    });
    expect(unlinkRes.status).toBe(200);

    // 確認
    const afterRes = await SELF.fetch(`http://localhost/api/projects/${projectId}/tags`, { headers });
    const afterData = await afterRes.json() as { tags: unknown[] };
    expect(afterData.tags.length).toBe(0);
  });
});

describe("Todo-Tag linking", () => {
  it("タグ紐付け・一覧・紐付け解除", async () => {
    // TODO作成
    const tRes = await createTodo({ title: "タグテストTODO" });
    const tData = await tRes.json() as { todo: { id: string } };
    const todoId = tData.todo.id;

    // タグID取得
    const tagsRes = await SELF.fetch("http://localhost/api/tags", { headers });
    const tagsData = await tagsRes.json() as { tags: { id: string; name: string }[] };
    const tagId = tagsData.tags.find((t) => t.name === "学習")!.id;

    // 紐付け
    const linkRes = await SELF.fetch(`http://localhost/api/todos/${todoId}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tag_id: tagId }),
    });
    expect(linkRes.status).toBe(201);

    // タスクのタグ一覧
    const tTagsRes = await SELF.fetch(`http://localhost/api/todos/${todoId}/tags`, { headers });
    expect(tTagsRes.status).toBe(200);
    const tTagsData = await tTagsRes.json() as { tags: { name: string }[] };
    expect(tTagsData.tags.find((t) => t.name === "学習")).toBeDefined();

    // 紐付け解除
    const unlinkRes = await SELF.fetch(`http://localhost/api/todos/${todoId}/tags/${tagId}`, {
      method: "DELETE",
      headers,
    });
    expect(unlinkRes.status).toBe(200);
  });
});

describe("Tag deletion cascade", () => {
  it("タグ削除時にjunction物理削除", async () => {
    const tagRes = await createTag({ name: "カスケードテスト" });
    const tagData = await tagRes.json() as { tag: { id: string } };
    const cascadeTagId = tagData.tag.id;

    const pRes = await createProject({ name: "カスケードPJ" });
    const pData = await pRes.json() as { project: { id: string } };

    await SELF.fetch(`http://localhost/api/projects/${pData.project.id}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tag_id: cascadeTagId }),
    });

    await SELF.fetch(`http://localhost/api/tags/${cascadeTagId}`, {
      method: "DELETE",
      headers,
    });

    const listRes = await SELF.fetch(`http://localhost/api/projects/${pData.project.id}/tags`, { headers });
    const listData = await listRes.json() as { tags: { name: string }[] };
    expect(listData.tags.find((t) => t.name === "カスケードテスト")).toBeUndefined();
  });
});
