import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations } from "./helpers";

beforeAll(async () => {
  await applyMigrations();
});

describe("Auth", () => {
  it("GET /health は認証不要", async () => {
    const res = await SELF.fetch("http://localhost/health");
    expect(res.status).toBe(200);
    const data = await res.json() as { status: string };
    expect(data.status).toBe("ok");
  });

  it("認証なしでAPIアクセスすると401", async () => {
    const res = await SELF.fetch("http://localhost/api/todos");
    expect(res.status).toBe(401);
  });

  it("不正なトークンで401", async () => {
    const res = await SELF.fetch("http://localhost/api/todos", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  it("正しいトークンで200", async () => {
    const res = await SELF.fetch("http://localhost/api/todos", {
      headers: { Authorization: "Bearer test-token" },
    });
    expect(res.status).toBe(200);
  });
});
