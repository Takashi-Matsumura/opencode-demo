# opencode-demo

ローカルの [llama.cpp](https://github.com/ggml-org/llama.cpp) + Gemma に接続した [OpenCode](https://opencode.ai/) を、ブラウザ内のフローティングターミナルから操作する Next.js デモ。背景は Excalidraw のホワイトボードキャンバス。

[Maestri](https://www.themaestri.app/) のような「キャンバス上にエージェント端末を浮かべる」UX の最小再現サンプルです。

## 構成

```
ブラウザ ─ / (Next.js, App Router)
            ├─ Excalidraw (全画面キャンバス、グリッド表示)
            ├─ FloatingWorkspace (ファイルエクスプローラ、フォルダ選択)
            │     ├─ [Coding] ボタン → コーディング用ターミナル起動
            │     └─ [Business] ボタン → データ処理用ターミナル起動
            ├─ FloatingTerminal (coding) ─ ダークテーマ
            │     ├─ 表面: OpenCode (TUI)
            │     └─ 裏面: Settings + Shell
            └─ FloatingTerminal (business) ─ Excel風グリーンテーマ
                  ├─ 表面: OpenCode (TUI, CSSフィルターでライトモード化)
                  └─ 裏面: Settings + Shell
                       │ ws://localhost:4097
                       ▼
            pty-server.ts (ws + node-pty, 複数セッション管理)
                       │ spawn
                       ▼
            opencode (TUI) ── OpenAI 互換 ──▶ llama-server (:8080)
                                                    │
                                                    ▼
                                                  Gemma
```

ターミナルはシーン座標にアンカーされているため、ホワイトボードをパン／ズームするとそれに追従して移動・拡大縮小します。

## 主な機能

- **デュアルターミナル** — 用途別に2つの独立した OpenCode ターミナルを同時起動可能。それぞれ独自の PTY セッション・設定を持ち、異なるワークスペースで作業できる。
  - **コーディング用 (OpenCode)** — 従来のダークテーマ。ソフトウェア開発向け。
  - **データ処理用 (Data Processing)** — Excel風のグリーンベース・ライトモード。非エンジニアにも親しみやすいデザイン。Excel/CSV の個人情報マスキング等、社内データ処理に最適。ローカル LLM で処理するため機密データが外部に出ない。
- **フリップターミナル** — 表面は OpenCode、裏面はインタラクティブシェル + 設定パネル。ヘッダ右端のアイコンで回転アニメーション切替。裏面シェルで `next dev -p 3001` 等のサーバを直接起動可能。
- **プロセス安全停止** — ターミナルを閉じると、PTY配下のプロセスツリーを SIGTERM → SIGKILL で段階的に停止。`OPENCODE_SESSION_ID` 環境変数による孤児プロセス追跡。
- **セッション再接続** — スクリーンロックやネットワーク切断でWebSocketが切れても、PTYセッションを5分間保持。復帰時に自動再接続し、切断中の出力もバッファから復元。
- **起動時の孤児回収** — PTYサーバ起動時に前回クラッシュで残った孤児プロセスを自動検出・停止。
- **ワークスペースエクスプローラ** — macOS ネイティブフォルダピッカー、ファイルツリー表示、ファイル内容プレビュー。
- **描画ツール切替** — Excalidraw の描画ツールバーをフッターから ON/OFF。Draw Over モードでフローティングパネルの上に描画可能。
- **ズーム制御** — フッターバーからズーム操作、リセット、80% フィット表示（緑丸クリック）。

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

3. ブラウザで http://localhost:3000 を開く。

## 操作

- **ホワイトボード**: マウスホイール／トラックパッドピンチでズーム、スペース＋ドラッグまたは手のひらツールでパン。
- **ワークスペース**: 「フォルダを選択...」でプロジェクトを開き、緑の「Coding」ボタンでコーディング用、アンバーの「Business」ボタンでデータ処理用ターミナルをそれぞれ起動。両方を同時に開くことも可能。
- **ターミナル**: ヘッダをドラッグで移動、右下コーナーでリサイズ。赤丸で停止、黄丸で最小化、緑丸でフィット表示。コーディング用はダークテーマ、データ処理用はExcel風グリーンテーマで表示。
- **表裏切替**: ヘッダ右端のアイコンで OpenCode ↔ Settings/Shell を回転切替。裏面シェルからサーバ起動等が可能。
- **フッター**: ズーム操作、Reset、Draw Over（パネル上に描画）、Toolbar（Excalidraw 描画ツール表示）。

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
app/
  page.tsx                       / のエントリ (dynamic import で SSR 無効化)
  demo/
    components/
      whiteboard-canvas.tsx      Excalidraw を全画面描画、scrollX/Y/zoom を通知
      floating-terminal.tsx      フリップ式ターミナル (coding/business variant対応)
      floating-workspace.tsx     ファイルエクスプローラ、フォルダ選択、デュアル起動ボタン
      xterm-view.tsx             xterm.js のマウントと WebSocket 接続 (自動再接続対応)
      opencode-settings.tsx      OpenCode 設定パネル (モデル、プロバイダ、権限)
    lib/
      ws-protocol.ts             ブラウザ ↔ pty-server のメッセージ型
server/
  pty-server.ts                  ws + node-pty セッション管理 (再接続・タイムアウト対応)
  process-cleanup.ts             プロセスツリー停止、孤児回収、セッションファイル管理
opencode.json                    llama.cpp プロバイダ設定
```

## 既知の注意点

- **`reactStrictMode: false` 必須**。Next.js 16 + React 19 + `@excalidraw/excalidraw@0.18` の組み合わせでは Strict Mode 有効時に Excalidraw のデスクトップ UI（`.layer-ui__wrapper`）が描画されないため、`next.config.ts` で無効化している。
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
