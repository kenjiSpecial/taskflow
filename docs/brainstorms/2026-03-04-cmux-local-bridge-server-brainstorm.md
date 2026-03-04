---
topic: cmux-local-bridge-server
date: 2026-03-04
status: active
---

# cmux ローカルブリッジサーバー

## 何を作るか

ブラウザの CmuxCopyButton クリック時に、ローカルHTTPサーバー経由で `taskflow-cmux start <session-id>` を直接実行する仕組み。

現状はクリップボードにコマンドをコピー → ユーザーが手動でターミナルにペーストという2ステップ。
これを1クリックで cmux workspace が立ち上がるようにする。

## なぜこのアプローチか

- ブラウザからローカルCLIを直接実行する手段がない
- カスタムURLスキームはOS登録が面倒でレスポンスも返せない
- ローカルHTTPサーバーなら fetch で呼べて結果もUIに反映できる
- 個人用ツールなのでセキュリティは 127.0.0.1 バインドで十分

## キー決定事項

| 項目 | 決定 |
|------|------|
| ランタイム | Bun (`Bun.serve`) |
| スコープ | まず `start` のみ（後で拡張可能） |
| 起動方法 | `taskflow-cmux serve` サブコマンドとして追加 |
| ポート | 19876 |
| バインド | 127.0.0.1 のみ |
| CORS | `localhost:5173` + `taskflow-ui.pages.dev` を許可 |
| フロントエンド | クリックで fetch → 失敗時はクリップボードコピーにフォールバック + 通知で「サーバー起動してください」と案内 |

## フロー

```
[ブラウザ] CmuxCopyButton クリック
    ↓ fetch("http://localhost:19876/start", {body: {sessionId}})
    ↓
[ローカル] taskflow-cmux serve (Bun)
    ↓ child_process で taskflow-cmux start <session-id> 実行
    ↓ 結果を JSON レスポンスで返す
    ↓
[ブラウザ] 成功: チェックマーク表示 / 失敗: エラー表示
    ↓ (サーバー未起動の場合)
    ↓ フォールバック: クリップボードコピー + 通知
```

## スコープ外

- stop / update / sync のHTTP化（将来拡張）
- 常駐化 / launchd 登録（必要になったら）
- 認証トークン（127.0.0.1限定なので不要）
