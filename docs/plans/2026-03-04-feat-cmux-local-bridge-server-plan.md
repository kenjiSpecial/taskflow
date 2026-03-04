---
title: "feat: cmux ローカルブリッジサーバー"
type: feat
status: completed
date: 2026-03-04
---

# cmux ローカルブリッジサーバー

ブラウザから `localhost:19876` 経由で `taskflow-cmux start` を実行し、1クリックで cmux workspace を起動する。

## Acceptance Criteria

- [x]`taskflow-cmux serve` でBunサーバーが `127.0.0.1:19876` で起動する
- [x]`POST /start` で `{sessionId}` を受け取り、`taskflow-cmux start` を実行して結果をJSONで返す
- [x]sessionId は UUIDv4 形式のみ受け付ける（インジェクション防止）
- [x]CORS: `http://localhost:5173` + `https://taskflow-ui.pages.dev` を許可
- [x]CmuxCopyButton がfetch → 失敗時はクリップボードコピー + 通知にフォールバック
- [x]ボタン連打防止（loading中はdisabled）
- [x]フロントエンド側fetchタイムアウト: 15秒

## 実装タスク

### 1. `taskflow-cmux-server.ts` 作成（新規ファイル）

Bun.serve でHTTPサーバー。

```typescript
// taskflow-cmux-server.ts
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://taskflow-ui.pages.dev",
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Bun.serve({
  port: 19876,
  hostname: "127.0.0.1",
  async fetch(req) {
    // CORS preflight
    // POST /start → sessionId バリデーション → Bun.spawn(["./taskflow-cmux", "start", sessionId])
    // stdout/stderr キャプチャ → JSON レスポンス
    // ANSIエスケープをstrip
    // in-flight Map で同一sessionIdの重複実行を防止
  },
});
```

**ポイント:**
- `Bun.spawn` で引数を配列渡し（シェル経由しない → インジェクション防止）
- ANSIカラーコードをstderrからstrip（`/\x1b\[[0-9;]*m/g`）
- sessionIdごとの in-flight Map で二重実行防止
- 子プロセスタイムアウト: 30秒

### 2. `taskflow-cmux` に `serve` サブコマンド追加

```bash
# taskflow-cmux の case文に追加
cmd_serve() {
  command -v bun >/dev/null 2>&1 || die "bun がインストールされていません"
  local server_script="$(dirname "$(realpath "$0")")/taskflow-cmux-server.ts"
  [[ -f "$server_script" ]] || die "server script が見つかりません: ${server_script}"
  log_info "ブリッジサーバーを起動中 (port 19876)..."
  exec bun run "$server_script"
}
```

### 3. `frontend/src/lib/bridge.ts` 作成（新規ファイル）

```typescript
// frontend/src/lib/bridge.ts
const BRIDGE_URL = "http://localhost:19876";

export async function bridgeStartSession(sessionId: string): Promise<{ ok: boolean; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BRIDGE_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
  // fetch失敗(サーバー未起動)は呼び出し元でcatch
}
```

**ストア規約について:** ブリッジはTaskflow APIとは別のローカルサーバーなので、`api.ts` のストア規約の例外とする。`bridge.ts` をライブラリとしてコンポーネントから直接利用。

### 4. `CmuxCopyButton.tsx` 改修

状態遷移: `idle` → `loading` → `success` / `error` / `fallback`

```
クリック
  → state = "loading"（ボタンdisabled、スピナー表示）
  → bridgeStartSession(sessionId)
    → 成功(ok: true): state = "success"（チェックマーク 1.5秒）
    → 失敗(ok: false): state = "error"（赤色 1.5秒）
    → fetch失敗(サーバー未起動):
      → クリップボードコピー
      → state = "fallback"（チェックマーク + 通知表示）
```

通知は簡易実装: ボタン近くにインライン表示 or `window.alert` の代わりに一時的なツールチップ。

### 5. CSS追加

- `.cmux-copy-btn.loading` — スピナーアニメーション
- `.cmux-copy-btn.error` — 赤色表示
- `.cmux-notification` — フォールバック通知テキスト

## セキュリティ

- **127.0.0.1 バインドのみ** — 外部からアクセス不可
- **UUID バリデーション** — コマンドインジェクション防止
- **Bun.spawn 配列引数** — シェル解釈を回避
- **CORSチェック** — 許可Originのみレスポンス返却
- 個人用ツールなのでトークン認証は不要

## 参照

- ブレスト: `docs/brainstorms/2026-03-04-cmux-local-bridge-server-brainstorm.md`
- 既存CLI: `taskflow-cmux` (L325-445: cmd_start)
- 既存ボタン: `frontend/src/components/CmuxCopyButton.tsx`
- Bun.serve: `Bun.serve({ port, hostname, fetch })`
- Bun.spawn: `Bun.spawn(["cmd", "arg"], { stdout: "pipe", stderr: "pipe" })`
