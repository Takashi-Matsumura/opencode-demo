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
      ┌────────────────────────────────────────┐
      │ Next.js (:3001) + pty-server (:4097)   │  ← ネイティブ or Docker
      │   └─ opencode (TUI)                    │
      └────────────────────────────────────────┘
                       │ OpenAI 互換 (host networking / localhost)
                       ▼
      llama-server (:8080) ──▶ Gemma   ← 常にホスト側
      LionFrame (:3000, OIDC Provider) ← 常にホスト側
```

ターミナルはシーン座標にアンカーされているため、ホワイトボードをパン／ズームするとそれに追従して移動・拡大縮小します。

`opencode` と `pty-server` を動かす実行環境は **ネイティブ** (`npm run dev:all`) と **Docker コンテナ** (`docker compose up`) の 2 択で、どちらでもブラウザから同じ `http://localhost:3001` で使えます。

## 主な機能

- **デュアルターミナル** — 用途別に2つの独立した OpenCode ターミナルを同時起動可能。それぞれ独自の PTY セッション・設定を持ち、異なるワークスペースで作業できる。
  - **コーディング用 (OpenCode)** — 従来のダークテーマ。ソフトウェア開発向け。
  - **データ処理用 (Data Processing)** — Excel風のグリーンベース・ライトモード。非エンジニアにも親しみやすいデザイン。Excel/CSV の個人情報マスキング等、社内データ処理に最適。ローカル LLM で処理するため機密データが外部に出ない。
- **フリップターミナル** — 表面は OpenCode、裏面はインタラクティブシェル + 設定パネル。ヘッダ右端のアイコンで回転アニメーション切替。裏面シェルで `next dev -p 3001` 等のサーバを直接起動可能。
- **プロセス安全停止** — ターミナルを閉じると、PTY配下のプロセスツリーを SIGTERM → SIGKILL で段階的に停止。`OPENCODE_SESSION_ID` 環境変数による孤児プロセス追跡。
- **セッション再接続** — スクリーンロックやネットワーク切断でWebSocketが切れても、PTYセッションを5分間保持。復帰時に自動再接続し、切断中の出力もバッファから復元。
- **起動時の孤児回収** — PTYサーバ起動時に前回クラッシュで残った孤児プロセスを自動検出・停止。
- **ワークスペースエクスプローラ** — macOS ネイティブフォルダピッカー（Docker モードでは in-app ブラウザに自動フォールバック）、ファイルツリー表示、ファイル内容プレビュー。
- **画像解析（ビジョン対応）** — Gemma 4 の mmproj 付き GGUF を使い、ワークスペース内の画像ファイルを `describe_image` カスタムツール経由で視覚解析。OpenCode のチャットで「この PNG を説明して」と書くと、Gemma 4 が自動でツールを呼び出し、画像の内容を日本語で記述して回答に組み込む。
- **ユーザー別ワークスペース隔離** — LionFrame OIDC 認証ごとに `~/opencode-demo-workspaces/{sub}/` を専用ホームとして自動作成。外部フォルダは明示登録制。PTY セッションも短命 JWT チケットで所有ユーザーに結び付く。
- **ドラッグ & ドロップアップロード** — ホストの Finder からファイルやフォルダをドロップするとワークスペース内に再帰的にアップロード。
- **Finder で開く** — ワークスペースヘッダの「Finder」ボタンで、ネイティブ時は直接 Finder を起動、Docker 時はホストパスをクリップボードへコピー（`⌘⇧G` で貼り付け）。
- **Docker 対応** — `docker compose up` でエージェント実行環境（Node + opencode CLI + PTY）を隔離コンテナに閉じ込められる。llama.cpp と LionFrame はホスト側のまま利用可能。
- **描画ツール切替** — Excalidraw の描画ツールバーをフッターから ON/OFF。Draw Over モードでフローティングパネルの上に描画可能。
- **ズーム制御** — フッターバーからズーム操作、リセット、80% フィット表示（緑丸クリック）。

## 必要なもの

- Node.js 22 以上 (動作確認: v25.9.0)
- macOS / Linux
- [llama.cpp](https://github.com/ggml-org/llama.cpp) の `llama-server` と任意の Gemma GGUF モデル（画像解析を使うなら Gemma 4 の mmproj 付き構成を推奨）
- [opencode](https://opencode.ai/) CLI (`brew install sst/tap/opencode` 等)

## セットアップ

```bash
npm install
cp .env.local.example .env.local
# .env.local を編集して LIONFRAME_* と SESSION_SECRET を埋める
openssl rand -hex 32    # SESSION_SECRET 用
```

`opencode.json` はリポジトリに同梱しており、`http://127.0.0.1:8080/v1` の OpenAI 互換エンドポイントを既定プロバイダにしています。別ホスト/別モデルを使う場合は編集してください。

### LionFrame のクライアント登録

LionFrame（`http://localhost:3000` で稼働）の管理 UI でこのアプリを OIDC クライアントとして登録し、以下を設定してください:

- `redirect_uris`: `http://localhost:3001/api/oidc/callback`
- 発行された `client_id` / `client_secret` を `.env.local` の `LIONFRAME_CLIENT_ID` / `LIONFRAME_CLIENT_SECRET` に設定

## 起動

1. **llama-server を起動**(別ターミナル) — Gemma 等を OpenAI 互換 API で公開:

   ```bash
   llama-server -m /path/to/gemma.gguf --port 8080
   ```

   画像解析を使う場合は、対応するビジョンプロジェクタ（mmproj GGUF）を `--mmproj` で追加してください:

   ```bash
   llama-server \
     -m /path/to/gemma-4-e4b-it-Q4_K_M.gguf \
     --mmproj /path/to/mmproj-gemma-4-e4b-it-f16.gguf \
     --port 8080 -ngl 999
   ```

2. **Next.js + pty-server を同時起動**:

   ```bash
   PTY_CMD=$(which opencode) npm run dev:all
   ```

3. ブラウザで http://localhost:3001 を開く（LionFrame が :3000 を使うためポートを変更）。未認証なら `/login` に誘導され、「LionFrame でログイン」で認証フローに入る。

## Docker で起動する

ホスト環境を汚さず、バックエンドのエージェント処理（opencode CLI 実行、ファイル操作、PTY）を隔離したコンテナで動かすことができます。生成 AI (llama.cpp) と LionFrame はホスト側で稼働したままで、コンテナからホストネットワークを経由して到達します。

### 前提

- Docker Desktop **4.26 以降**
- Docker Desktop の **host networking を有効化**: Settings → Resources → Network → *Enable host networking* をオン（macOS では experimental 扱いのことあり）
- ホスト側で LionFrame (:3000) と llama-server (:8080) が稼働していること
- `.env.local` 作成済み（ネイティブ起動と同じもの）

### 起動

```bash
docker compose up --build
```

初回は opencode CLI と npm 依存のビルドのため数分かかります。その後はブラウザで http://localhost:3001 を開くだけ（ネイティブ起動と同じ URL）。

### コンテナでの挙動の違い

- **フォルダピッカー**: macOS Finder ダイアログは Linux コンテナ内では使えないので、in-app のディレクトリブラウザ（モーダル）が自動的に開きます。ブラウズ範囲は `~/opencode-demo-workspaces/{sub}/` 配下のみ
- **外部フォルダ登録**: コンテナから見えるのはマウントしたパスだけなので、ホストの `~/opencode-demo-workspaces/` と `~/.opencode-demo/` 以外にあるフォルダは登録できません。必要なら `compose.yml` の `volumes` に追加してください
- **PTY の cwd**: ホストの `~/opencode-demo-workspaces/{sub}/` は コンテナ内では `/root/opencode-demo-workspaces/{sub}/` にマウントされますが、`os.homedir()` が同じ `/root` を返すためパスは自然に整合します

### トラブルシュート

- コンテナから LionFrame や llama.cpp に繋がらない → host networking が効いているか確認: `docker compose exec opencode-demo curl http://localhost:3000/api/oidc/.well-known/openid-configuration`
- 既存の `node_modules`（macOS 用ネイティブ）がコンテナ内に漏れる → `compose.yml` の `/app/node_modules` anonymous volume が効いているはず。怪しければ `docker compose build --no-cache`
- opencode の install で止まる → `Dockerfile` の `curl https://opencode.ai/install | bash` 行を、環境に合わせた手段に差し替え

## 操作

- **ホワイトボード**: マウスホイール／トラックパッドピンチでズーム、スペース＋ドラッグまたは手のひらツールでパン。
- **ワークスペース**: 「フォルダを選択...」でプロジェクトを開き、緑の「Coding」ボタンでコーディング用、アンバーの「Business」ボタンでデータ処理用ターミナルをそれぞれ起動。両方を同時に開くことも可能。一覧から登録済みワークスペースの切替・削除もできる。
- **ファイル追加**: ホストの Finder / Explorer からフォルダツリーのペインにファイル・フォルダをドラッグ & ドロップすればワークスペースに取り込める。
- **Finder で開く**: ヘッダの「Finder」ボタンでワークスペースをホストで開く（Docker 時はパスをクリップボードコピー）。
- **ターミナル**: ヘッダをドラッグで移動、右下コーナーでリサイズ。赤丸で停止、黄丸で最小化、緑丸でフィット表示。コーディング用はダークテーマ、データ処理用はExcel風グリーンテーマで表示。
- **表裏切替**: ヘッダ右端のアイコンで OpenCode ↔ Settings/Shell を回転切替。裏面シェルからサーバ起動等が可能。
- **フッター**: ズーム操作、Reset、Draw Over（パネル上に描画）、Toolbar（Excalidraw 描画ツール表示）。

## 画像解析（ビジョン対応）

Gemma 4 の vision 機能を OpenCode から使うためのブリッジとして、ワークスペース内に配置するカスタムツールと指示ファイルを同梱しています。

### 仕組み

```
OpenCode (Gemma 4, テキスト)
   │ tool_call
   ▼
.opencode/tools/describe_image.ts  ← リポジトリ同梱のテンプレート
   │ fetch (OpenAI 互換 /v1/chat/completions)
   │   content=[image_url (base64), text]
   ▼
llama.cpp + mmproj (Gemma 4, vision)
   │
   ▼ 画像の記述テキスト
tool_result → Gemma 4 がそれを踏まえて回答
```

ユーザーが OpenCode チャットで「`screenshot.png` の内容を説明して」のように書くと、`vision-rules.md` の指示に従って Gemma 4 が `describe_image` ツールを呼び出します。ツール内部で画像を base64 化し、再度 llama.cpp の `image_url` 経路（`--mmproj` 必須）でビジョン解析を行い、結果の説明文をエージェントに返します。

### セットアップ

各ワークスペース (`~/opencode-demo-workspaces/{sub}/`) に以下をコピーまたはシンボリックリンクしてください。リポジトリルートのテンプレートをそのまま流用できます:

```bash
WS=~/opencode-demo-workspaces/<workspace-id>
mkdir -p "$WS/.opencode/tools"
cp .opencode/tools/describe_image.ts "$WS/.opencode/tools/"
cp vision-rules.md "$WS/"
```

ワークスペースの `opencode.json` にも以下を追加します（新規ワークスペースは空の `opencode.json` が作られるため明示設定が必要）:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["vision-rules.md"],
  "provider": {
    "llamacpp": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "llama.cpp (local)",
      "options": {
        "baseURL": "http://host.docker.internal:8080/v1"
      },
      "models": {
        "gemma-4-e4b-it-Q4_K_M.gguf": { "name": "Gemma 4 E4B IT (Q4_K_M)" }
      }
    }
  },
  "model": "llamacpp/gemma-4-e4b-it-Q4_K_M.gguf"
}
```

ネイティブ起動（Docker を使わない）の場合は `baseURL` を `http://127.0.0.1:8080/v1` にしてください。

### 環境変数（ツール側）

`describe_image.ts` は以下の環境変数で挙動を上書きできます。

| 変数 | 既定値 | 用途 |
|---|---|---|
| `LLAMA_VISION_URL` | `http://host.docker.internal:8080/v1/chat/completions` | ビジョン解析のエンドポイント |
| `LLAMA_VISION_MODEL` | `gemma-4-e4b-it-Q4_K_M.gguf` | `model` フィールドに渡すモデル名 |

### 制限

- Gemma 4 は reasoning モデルのため、`max_tokens` が小さいと思考途中で打ち切られて `content` が空になる。ツール内は 2048 で固定しているが、複雑な画像では増やす余地あり。
- Q4_K_M 量子化 + デフォルト視覚トークン予算では細かい OCR は精度不足。スクリーンショットの大まかな把握には十分。
- ブラウザ内 PTY の構造上、OpenCode TUI にクリップボード画像を直接ペースト／ドロップで渡すことはできません。必ずワークスペース内のファイルを経由してください。

## 環境変数

| 変数 | 既定値 | 用途 |
|---|---|---|
| `PTY_CMD` | `opencode` | pty-server が spawn するコマンド。フルパス指定推奨 |
| `PTY_CWD` | `process.cwd()` | spawn 時の作業ディレクトリ |
| `PTY_PORT` | `4097` | WebSocket ポート |
| `NEXT_PUBLIC_PTY_WS_URL` | `ws://127.0.0.1:4097` | ブラウザから接続する WS URL |
| `LIONFRAME_ISSUER` | — | LionFrame OIDC Provider の Issuer ベース URL（例: `http://localhost:3000/api/oidc`） |
| `LIONFRAME_CLIENT_ID` | — | LionFrame で登録したクライアント ID |
| `LIONFRAME_CLIENT_SECRET` | — | LionFrame で登録したクライアントシークレット |
| `NEXTAUTH_URL` | `http://localhost:3001` | RP（この opencode-demo）の公開 URL。`redirect_uri` 組み立てに使用 |
| `SESSION_SECRET` | — | `oidc_session` JWT（HS256）の署名鍵。`openssl rand -hex 32` で生成 |
| `HOST_HOME` | （コンテナ内のみ） | `compose.yml` がホストの `$HOME` を注入。Docker モードで「Finder で開く」時のホストパス変換に使用 |

## スクリプト

| コマンド | 動作 |
|---|---|
| `npm run dev` | Next.js のみ起動（:3001） |
| `npm run dev:pty` | pty-server のみ起動（`.env.local` を `--env-file` で読み込み、:4097） |
| `npm run dev:all` | 上記2つを同時起動（ネイティブ実行、推奨） |
| `npm run build` | Next.js 本番ビルド |
| `npm run lint` | ESLint |
| `docker compose up` | Docker コンテナで Next.js + pty-server をまとめて起動 |
| `docker compose build` | コンテナイメージ (Node 22 + opencode CLI) を再ビルド |
| `docker compose down` | コンテナを停止・削除 |

## ファイル構成

```
app/
  page.tsx                       / のエントリ (dynamic import で SSR 無効化)
  login/page.tsx                 LionFrame ログインボタンのみのシンプルなページ
  api/
    oidc/                        OIDC RP エンドポイント (auth, callback, session, logout)
    user/workspaces/             ワークスペース一覧・登録・削除・open・reveal
    workspace/                   ディレクトリ一覧・ファイル取得・アップロード
    browse/                      Linux コンテナ用の代替ディレクトリブラウザ API
    pty-ticket/                  PTY 接続用の短命 JWT チケット発行
    pick-folder/                 macOS osascript フォルダピッカー (Linux では 501)
    opencode-config/             opencode.json の読み書き
  components/
    auth-status.tsx              footer 左端のユーザー名 + ログアウトボタン
    folder-picker-dialog.tsx     Docker 用の in-app ディレクトリブラウザ
    register-external-dialog.tsx 外部フォルダ登録確認モーダル
  lib/
    oidc/                        jose ベースの OIDC クライアント + セッション
    user-store.ts                ~/.opencode-demo/users/{sub}.json の読み書き
    workspace-access.ts          パスが自ユーザーのホーム or 登録外部かを検証
    workspace-session.ts         token → {sub, rootRealPath, workspaceId} の対応
    workspace-guard.ts           sub + token + パス検証
    pty-ticket.ts                PTY チケットの発行・検証
    host-path.ts                 コンテナ /root/... → ホスト /Users/.../ 変換
  demo/
    components/
      whiteboard-canvas.tsx      Excalidraw を全画面描画、scrollX/Y/zoom を通知
      floating-terminal.tsx      フリップ式ターミナル (coding/business variant対応)
      floating-workspace.tsx     ファイルエクスプローラ、DnD アップロード、Finder 起動
      xterm-view.tsx             xterm.js + WebSocket + チケット取得 (自動再接続対応)
      opencode-settings.tsx      OpenCode 設定パネル (モデル、プロバイダ、権限)
    lib/
      ws-protocol.ts             ブラウザ ↔ pty-server のメッセージ型
server/
  pty-server.ts                  ws + node-pty + チケット検証 (sub 一致で再接続許可)
  process-cleanup.ts             プロセスツリー停止、孤児回収、セッションファイル管理
proxy.ts                         Next.js 16 ルート保護 (oidc_session cookie 有効性で判定)
Dockerfile                       node:22 + opencode CLI の開発用イメージ
compose.yml                      host networking + ~/.opencode-demo 等のボリューム構成
.dockerignore                    Docker build context から除外するファイル
opencode.json                    llama.cpp プロバイダ設定 + instructions
vision-rules.md                  画像解析時の OpenCode への指示（テンプレート）
.opencode/tools/
  describe_image.ts              ワークスペース画像を llama.cpp ビジョンへ転送するカスタムツール（テンプレート）
```

## 既知の注意点

- **`reactStrictMode: false` 必須**。Next.js 16 + React 19 + `@excalidraw/excalidraw@0.18` の組み合わせでは Strict Mode 有効時に Excalidraw のデスクトップ UI（`.layer-ui__wrapper`）が描画されないため、`next.config.ts` で無効化している。
- **node-pty は `@homebridge/node-pty-prebuilt-multiarch` を使用**。本家 `node-pty@1.1.0` は Node.js v25 で `posix_spawnp failed` エラーが出るため。
- **`PTY_CMD` はフルパス指定が安全**。`tsx` 経由で起動した子プロセスの PATH 解決に依存しないため。
- **Vercel 等の serverless にはそのままデプロイ不可**。pty-server が常駐 Node.js プロセスを必要とするため、Docker / Railway / Render などへの自前デプロイが必要です。
- **localhost 専用構成**。WebSocket は無認証なので、外部公開する場合はトークン認証を追加してください。
- **OIDC 認証は Next.js 配下のみ**。`proxy.ts` で `/login` と `/api/oidc/*` 以外の全ルートを保護していますが、`ws://localhost:4097` の PTY サーバは別プロセスで Next.js を経由しないため、認証対象外です。外部公開時は pty-server 側にも別途認証を追加してください。
- **Docker 起動は host networking 必須**。bridge + `host.docker.internal` では LionFrame 発行の ID Token の `iss` とサーバ側検証先が噛み合わず OIDC フローが壊れます。production 用 multi-stage ビルドは別タスク。

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
