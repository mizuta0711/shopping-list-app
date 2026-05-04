# 認証システムガイド

## NextAuth.js 4 設定

**設定ファイル**: `src/lib/auth.ts`

## プロバイダー

| プロバイダー | 状態 | 説明 |
|---|---|---|
| Google OAuth | 実装済み | Google アカウントでサインイン |
| GitHub OAuth | 計画中 | 必要に応じて追加 |

## セッション管理

- Strategy: **Database**（Prisma Adapter 経由で `Session` テーブルに保存）
- セッショントークンは Cookie（HttpOnly）で配布
- `session.user.id` でユーザー識別

## 必須モデル（Prisma Adapter）

`prisma/schema.prisma` に以下4モデルを定義:

- `User` — ユーザー本体
- `Account` — OAuth プロバイダーごとの連携情報
- `Session` — アクティブなセッション
- `VerificationToken` — メール検証用（将来拡張）

## 必須環境変数

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=  # openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Google Cloud Console で OAuth クライアントを作成し、承認済みリダイレクト URI に
`{NEXTAUTH_URL}/api/auth/callback/google` を登録する。

## API認証パターン

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
      { status: 401 }
    );
  }
  // session.user.id でユーザー識別
}
```

## クライアント認証

- `SessionProvider` でアプリをラップ（`src/components/providers/`）
- `useSession()` でログイン状態確認
- サインインは `signIn('google')`、サインアウトは `signOut()`

```typescript
import { useSession, signIn, signOut } from 'next-auth/react';

const { data: session, status } = useSession();

if (status === 'loading') return null;
if (status === 'unauthenticated') return <button onClick={() => signIn('google')}>Sign in</button>;
```

## サインインフロー

1. ユーザーが「Google でサインイン」ボタンをクリック → `signIn('google')`
2. Google OAuth 同意画面 → コールバック `/api/auth/callback/google`
3. NextAuth が `User` / `Account` / `Session` を作成・更新
4. セッション Cookie が発行され、アプリにリダイレクト

## セキュリティ

| 対象 | 対策 |
|------|------|
| セッション | DB セッション（サーバーサイドで都度検証可能、無効化も即時反映） |
| シークレット | `NEXTAUTH_SECRET` / OAuth クライアントシークレットは `.env.local` のみ（コミット禁止） |
| CSRF | NextAuth 組み込み対策 |
| Cookie | HttpOnly / Secure（本番）/ SameSite=Lax |

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-04-02 | - | 初版作成（テンプレート適用） | Claude Code |
| 2.0 | 2026-05-04 | - | 実装に合わせて Google OAuth + Database セッション構成に更新 | Claude Code |
