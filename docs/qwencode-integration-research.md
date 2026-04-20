# QwenCode 併用統合 調査メモ

調査日: 2026-04-20
ステータス: 調査のみ（実装・計画未着手）

このドキュメントは、現行の OpenCode ベースのデモアプリに QwenCode を併用できるかを調べた結果をまとめたもの。将来、開発テーマとして採用するかを判断するための素材。

---

## 1. QwenCode とは

| 項目 | 内容 |
|---|---|
| リポジトリ | [QwenLM/qwen-code](https://github.com/QwenLM/qwen-code) |
| 正体 | Google Gemini CLI の **フォーク**（Qwen 系モデル向けにパーサを改変） |
| ライセンス | Apache-2.0 |
| 必須環境 | Node.js 20+ |
| インストール | `npm install -g @qwen-code/qwen-code` / Homebrew / curl インストーラ |
| 起動 | 対話 REPL: `qwen` ／ ヘッドレス: `qwen -p "..."` |
| 設定（グローバル） | `~/.qwen/settings.json` |
| 設定（プロジェクト） | `.qwen/settings.json`（プロジェクトがグローバルを上書き） |
| API 対応 | OpenAI 互換 API に対応（`baseUrl` + `envKey` で差せる）、Anthropic・Gemini もサポート |
| 拡張機構 | Skills / SubAgents（組み込み）、MCP 対応あり |
| 主要コマンド | `/help`, `/auth`, `/clear`, `/exit` など |

### 2026-04 時点の注意

- **Qwen 無料 OAuth は 2026-04-15 で終了**。現在は Alibaba Cloud Coding Plan / OpenRouter / Fireworks AI / BYOK のいずれかが必要。
- 最新は Qwen3.6-Plus（Alibaba Cloud ModelStudio 経由の OpenAI 互換 API）。

---

## 2. 現行アプリの統合点マッピング

統合時に触ることになる箇所を、現状と必要改修に分けて整理。

### 2.1 既に Agent 非依存な部分（改修ほぼ不要）

- `server/pty-server.ts`
  - L10: `const OC_CMD = process.env.PTY_CMD ?? "opencode";` — デフォルト値でしかない。
  - L131-138: `cmdOverride` を受けて任意コマンドを起動できる構造。
  - L224: WebSocket 接続時の `?cmd=...` クエリで上書き可能。
  - → **`?cmd=qwen` を送るだけで QwenCode を起動できる。サーバ側改修ゼロ。**
- `app/demo/components/xterm-view.tsx`
  - 既に `cmd` prop を受け取れる（`cmd="shell"` で実利用あり）。

### 2.2 改修が必要な部分

| 対象 | 変更内容 |
|---|---|
| `Dockerfile` | `RUN npm install -g @qwen-code/qwen-code` を追加。`qwen` バイナリを PATH に乗せる |
| `app/demo/components/floating-terminal.tsx` | `XtermView` 呼び出しに `cmd` prop を渡せるようにする（現在は OpenCode 決め打ち） |
| `app/page.tsx` | Agent セレクタ UI を追加（どの端末でどの CLI を起動するか） |
| `app/api/opencode-config/route.ts` の対 | `app/api/qwen-config/route.ts` を対で用意。`.qwen/settings.json` を読み書き |
| `app/demo/components/opencode-settings.tsx` の対 | `QwenSettings` コンポーネントを別途作成。**スキーマが違うので流用不可**（`modelProviders` / `security.auth` など構造が別物） |
| 画像解析ブリッジ | 現行 `.opencode/tools/describe_image.ts` は **OpenCode 専用**。QwenCode 側では Skills/SubAgents or MCP サーバで再実装が必要 |

### 2.3 現在 OpenCode 固有で、QwenCode には流用できないもの

- `opencode.json`（プロバイダ・モデル・instructions・permissions などのスキーマ）
- `.opencode/tools/*.ts`（`@opencode-ai/plugin` の `tool()` ヘルパ前提）
- `vision-rules.md` を instructions として読み込ませる仕組み（QwenCode は `QWEN.md` 相当を別途指定）
- UI の「OpenCode を停止」「OpenCode Config」などの文字列

---

## 3. 両立のポイント（設計上の示唆）

### 3.1 画像ブリッジは MCP サーバ化が筋

現行 `describe_image` ツールは OpenCode の `.opencode/tools/` 配下に置く前提。同じ機能を QwenCode からも使いたい場合、**MCP サーバとして切り出す**のが自然。MCP は OpenCode・QwenCode の両方が対応しているため、1 本書けば両方から呼べる。

### 3.2 モデル相性の注意

QwenCode は Qwen 向けにパーサを改変しているため、**現行のローカル Gemma 4 をそのまま差すと出力整形で相性問題が出る可能性あり**。素直な組み合わせは:

- OpenCode × Gemma 4（現行維持）
- QwenCode × Qwen3-Coder（Alibaba / OpenRouter 経由 or ローカル）

### 3.3 ワークスペース単位の Agent 切替

PTY サーバが `?cmd=...` を既に受けるため、**ワークスペースの設定ファイルに「使用 Agent」フィールドを 1 個足す**だけで切替可能。UI でラジオボタン等を足す実装になる。

---

## 4. 想定する統合パターン（未決）

採用時にユーザーへ問うべき選択肢:

1. **ワークスペース単位で OpenCode / QwenCode を固定**
   設定で選ぶ。切替は再起動。最も実装が軽い。
2. **同一ワークスペースで両方を同時起動**
   端末を 2 つ出して比較する用途。UI 改修がそこそこ必要。
3. **コマンドパレット的に都度選ぶ**
   柔軟だが UI 負荷が高い。

デモとして見せたいストーリーに応じて選ぶ。

---

## 5. 結論

**技術的には統合可能性が非常に高い。** 現行アーキテクチャ（特に PTY サーバの `cmd` 汎用化）が既に Agent 非依存な作りになっているため、CLI のインストール・UI 切替・設定ファイル読み書きを追加すれば済む。

本格着手する場合の未決事項:

- Qwen モデルの調達方法（Alibaba / OpenRouter / ローカル）
- 画像ブリッジを MCP 化するかしないか
- UI での Agent 切替粒度（上記パターン 1/2/3）

---

## 参考リンク

- [QwenLM/qwen-code (GitHub)](https://github.com/QwenLM/qwen-code)
- [@qwen-code/qwen-code (npm)](https://www.npmjs.com/package/@qwen-code/qwen-code)
- [Qwen Code overview (docs)](https://qwenlm.github.io/qwen-code-docs/en/users/overview/)
- [Qwen Code CLI: A Guide With Examples (DataCamp)](https://www.datacamp.com/tutorial/qwen-code)
