# opencode-demo

ローカルの [llama.cpp](https://github.com/ggml-org/llama.cpp) + Gemma に接続した [OpenCode](https://opencode.ai/) を、ブラウザ内のフローティングターミナルから操作する Next.js デモ。背景は Excalidraw のホワイトボードキャンバス。

[Maestri](https://www.themaestri.app/) のような「キャンバス上にエージェント端末を浮かべる」UX の最小再現サンプルです。

## 構成

```
ブラウザ ─ /demo (Next.js, App Router)
            ├─ Excalidraw (全画面キャンバス)
            └─ FloatingTerminal (xterm.js)
                       │ ws://localhost:4097
                       ▼
            pty-server.ts (ws + node-pty)
                       │ spawn
                       ▼
            opencode (TUI) ── OpenAI 互換 ──▶ llama-server (:8080)
                                                    │
                                                    ▼
                                                  Gemma
```

## 必要なもの

- Node.js 22 以上 (動作確認: v25.9.0)
- macOS / Linux
- [llama.cpp](https://github.com/ggml-org/llama.cpp) の `llama-server` と任意の Gemma GGUF モデル
- [opencode](https://opencode.ai/) CLI (`brew install sst/tap/opencode` 等)

## セットアップ

```bash
npm install
```

`opencode.json` はリポジトリに同梱しており、`http://127.0.0.1:8080/v1` の OpenAI 互換エンドポイントを既定プロバイダにしています。別ホスト/別モデルを使う場合は編集してください。

## 起動

1. **llama-server を起動**(別ターミナル) — Gemma 等を OpenAI 互換 API で公開:

   ```bash
   llama-server -m /path/to/gemma.gguf --port 8080
   ```

2. **Next.js + pty-server を同時起動**:

   ```bash
   PTY_CMD=$(which opencode) npm run dev:all
   ```

3. ブラウザで http://localhost:3000/demo を開く。

## 環境変数

| 変数 | 既定値 | 用途 |
|---|---|---|
| `PTY_CMD` | `opencode` | pty-server が spawn するコマンド。フルパス指定推奨 |
| `PTY_CWD` | `process.cwd()` | spawn 時の作業ディレクトリ |
| `PTY_PORT` | `4097` | WebSocket ポート |
| `NEXT_PUBLIC_PTY_WS_URL` | `ws://127.0.0.1:4097` | ブラウザから接続する WS URL |

## スクリプト

| コマンド | 動作 |
|---|---|
| `npm run dev` | Next.js のみ起動 |
| `npm run dev:pty` | pty-server のみ起動 |
| `npm run dev:all` | 上記2つを同時起動 (推奨) |
| `npm run build` | Next.js 本番ビルド |
| `npm run lint` | ESLint |

## ファイル構成

```
app/demo/
  page.tsx                       /demo のエントリ (dynamic import で SSR 無効化)
  components/
    whiteboard-canvas.tsx        Excalidraw を全画面に描画
    floating-terminal.tsx        ドラッグ移動・リサイズ可能なウィンドウ
    xterm-view.tsx               xterm.js のマウントと WebSocket 接続
  lib/
    ws-protocol.ts               ブラウザ ↔ pty-server のメッセージ型
server/
  pty-server.ts                  ws + node-pty で opencode を spawn
opencode.json                    llama.cpp プロバイダ設定
```

## 既知の注意点

- **node-pty は `@homebridge/node-pty-prebuilt-multiarch` を使用**。本家 `node-pty@1.1.0` は Node.js v25 で `posix_spawnp failed` エラーが出るため。
- **`PTY_CMD` はフルパス指定が安全**。`tsx` 経由で起動した子プロセスの PATH 解決に依存しないため。
- **Vercel 等の serverless にはそのままデプロイ不可**。pty-server が常駐 Node.js プロセスを必要とするため、Docker / Railway / Render などへの自前デプロイが必要です。
- **localhost 専用構成**。WebSocket は無認証なので、外部公開する場合はトークン認証を追加してください。

## 使用ライブラリのライセンス

| ライブラリ | ライセンス |
|---|---|
| Next.js / React | MIT |
| Excalidraw | MIT |
| xterm.js | MIT |
| @homebridge/node-pty-prebuilt-multiarch | MIT |
| ws | MIT |

OpenCode 本体は MIT、llama.cpp は MIT、Gemma モデルは Google の利用規約に従ってください。

## このプロジェクトのライセンス

[MIT License](./LICENSE) — Copyright (c) 2026 Takashi Matsumura
