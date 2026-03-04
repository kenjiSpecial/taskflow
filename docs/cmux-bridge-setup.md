# cmux ブリッジサーバー セットアップガイド

ブラウザからワンクリックで cmux workspace を起動するためのローカルHTTPSサーバー。

## 前提条件

- [cmux](https://cmux.dev) がインストール済み
- `jq`, `curl` がインストール済み

## 1. 依存ツールのインストール

```bash
# Bun（ブリッジサーバーのランタイム）
curl -fsSL https://bun.sh/install | bash

# mkcert（HTTPS用ローカル証明書生成ツール）
brew install mkcert
```

## 2. ローカルTLS証明書の作成

```bash
# ローカルCAをシステムに登録（初回のみ）
mkcert -install

# 証明書を生成
mkdir -p ~/.taskflow-cmux
mkcert -cert-file ~/.taskflow-cmux/cert.pem \
       -key-file ~/.taskflow-cmux/key.pem \
       localhost 127.0.0.1
```

証明書は2年間有効。期限切れ後は同じコマンドで再生成。

## 3. taskflow-cmux の設定

```bash
cat > ~/.taskflow-cmux/config.json << 'EOF'
{
  "api_token": "YOUR_API_TOKEN_HERE",
  "api_url": "https://taskflow.kenji-draemon.workers.dev"
}
EOF
chmod 600 ~/.taskflow-cmux/config.json
```

`api_token` は Taskflow API の Bearer トークン。

### オプション: プロジェクトディレクトリのマッピング

```json
{
  "api_token": "...",
  "project_dirs": {
    "my-project": "~/github/my-project"
  }
}
```

## 4. ブリッジサーバーの起動

```bash
cd /path/to/taskflow
./taskflow-cmux serve
```

正常起動すると以下が表示される:

```
info: ブリッジサーバーを起動中 (http://127.0.0.1:19876)...
cmux bridge server listening on https://127.0.0.1:19876
```

TLS証明書がない場合は HTTP で起動する（Chrome では動作するが cmux 内蔵ブラウザでは動作しない）。

## 使い方

1. `taskflow-cmux serve` を起動した状態で
2. ブラウザ（https://taskflow-ui.pages.dev）でセッションカードのターミナルアイコンをクリック
3. 既存のworkspaceがあれば → フォーカス移動
4. なければ → 新しいworkspaceを自動作成

### サーバー未起動時

ボタンをクリックすると `taskflow-cmux start <session-id>` がクリップボードにコピーされ、通知が表示される。

## トラブルシューティング

### ポートが使用中

```
error: ポート 19876 は既に使用中です。
```

→ `lsof -ti:19876 | xargs kill` で既存プロセスを停止

### 証明書エラー

```
warn: TLS証明書が見つかりません
```

→ 手順2を実行して証明書を生成

### cmux 内蔵ブラウザで動作しない

→ TLS証明書が正しくインストールされているか確認: `mkcert -install`

## アーキテクチャ

```
[ブラウザ] ボタンクリック
    ↓ fetch POST https://127.0.0.1:19876/open
[Bun サーバー] taskflow-cmux-server.ts
    ├─ 既存 workspace あり → cmux select-workspace (フォーカス)
    └─ なし → taskflow-cmux start (新規作成)
    ↓ JSON レスポンス
[ブラウザ] 結果表示
```

- ポート: 19876
- バインド: 127.0.0.1 のみ（外部アクセス不可）
- CORS: `localhost:5173`, `taskflow-ui.pages.dev` を許可
