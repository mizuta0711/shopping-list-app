# shopping-list-app

買い物リストアプリ

## スタック

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- TailwindCSS 4 + shadcn/ui + Zustand 5
- Prisma 6 + PostgreSQL + NextAuth 4 (Google)
- Playwright（ブラウザテスト）

## 起動手順（ローカル）

```bash
npm install
cp .env.example .env.local   # 値を埋める
npx prisma generate
npm run dev                  # http://localhost:3000
```

## Dev Container での開発手順（推奨）

WSL2 + Dev Container を使い、ホスト（Windows）にランタイムを入れずに開発する。

### 前提

- Windows + WSL2（Ubuntu）セットアップ済み
- Docker Desktop インストール済み・WSL2 統合 ON
- VS Code に拡張機能 `ms-vscode-remote.remote-containers` インストール済み
- WSL 側で `claude` がログイン済み（`claude /status` で確認）
- WSL 側に `~/.claude.json` が無ければ `touch ~/.claude.json`

### 手順

```bash
# WSL ターミナル（必ず WSL から起動すること。Windows 側から開くと認証マウントが効かない）
cd ~/Project/Web/shopping-list-app
code .
```

VS Code が開いたら、コマンドパレット（`Ctrl+Shift+P`）→ **Dev Containers: Reopen in Container**

初回ビルドは数分かかる。完了後、コンテナ内ターミナルで:

```bash
claude /status         # ログイン済みであることを確認
npx prisma generate    # 初回のみ
npm run dev            # http://localhost:3000
```

## ポート

- 3000: Next.js（NextAuth のため `requireLocalPort: true`）
- 5432: PostgreSQL

## 環境変数

`.env.example` を参照。`DATABASE_URL` / `NEXTAUTH_URL` / `NEXTAUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を `.env.local` に設定する。
