<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git 運用ルール（このリポジトリの例外）

このリポジトリはデモ Web アプリであり、厳密なコードレビューは不要。**グローバルの `~/.claude/CLAUDE.md` にある「main への直 push 禁止」ルールを、このリポジトリでは適用しない。**

- `main` への直接 commit / push を許可する。
- feature ブランチ + PR を作る必要はない（作っても構わないが必須ではない）。
- 「ブランチを切りましょうか？」の事前提案も不要。ユーザーがそう指示した場合のみ切る。
- それ以外の Git 運用（コミットメッセージの書き方など）は従来通り。
