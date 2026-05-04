# Next.js 実装ガイド

> **重要**: このプロジェクトは **Next.js 16.2.2** を使用。Next.js 16 は従来バージョンから破壊的変更あり。実装前に必ず `node_modules/next/dist/docs/` を確認すること。

## App Router

- `src/app/` 配下にページ・APIルートを配置
- ページ: `page.tsx`（`"use client"` 使用）
- レイアウト: `layout.tsx`
- API: `src/app/api/` 配下に `route.ts`

## API Route パターン

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 認証チェック（NextAuth session）
    // ビジネスロジック（Service layer経由）
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '処理に失敗しました' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // バリデーション
    // ビジネスロジック
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '処理に失敗しました' } },
      { status: 500 }
    );
  }
}
```

## 認証

- **NextAuth 4** (`next-auth`) — Credentials provider（email/password）
- セッション管理: JWT strategy
- Protected routes: API routes で `getServerSession()` チェック
- クライアント: `useSession()` フック / `SessionProvider`

## データフェッチ

- Server Components は使用していない（全ページ `"use client"`）
- クライアントサイド: カスタムフック（`useState` + `useEffect` + `useCallback`）
- Zustand stores をAPIキャッシュとして併用

## 環境変数

| 種類 | 用途 | アクセス |
|------|------|---------|
| `NEXT_PUBLIC_*` | クライアント公開用 | クライアント・サーバー両方 |
| その他 | サーバーサイドのみ | サーバーサイドのみ |

- AI APIキーは暗号化してDB保存、サーバーサイドで復号

## ビルド・開発コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（ポート3000） |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint実行 |

テストフレームワークは未設定。

## Path Alias

- `@/*` → `./src/*`（`tsconfig.json` で設定）

## ディレクトリ構成

```
src/app/
├── layout.tsx          # ルートレイアウト
├── page.tsx            # チャットホーム（/）
├── onboarding/
│   └── page.tsx        # オンボーディング
├── knowledge/
│   ├── page.tsx        # ナレッジ一覧
│   └── [id]/
│       └── page.tsx    # ナレッジ詳細
├── status/
│   └── page.tsx        # ペットステータス
├── login/
│   └── page.tsx        # ログイン
├── register/
│   └── page.tsx        # ユーザー登録
└── api/
    ├── auth/           # NextAuth API
    └── v1/             # REST API（v1）
```

## 改訂履歴

| 版数 | 日付 | 内容 | 担当 |
|------|------|------|------|
| 1.0 | 2026-04-02 | 初版作成（テンプレート適用） | Claude Code |
