# 認証システムガイド

## NextAuth.js 4 設定

**設定ファイル**: `src/lib/auth.ts`

## プロバイダー

| プロバイダー | 状態 | 説明 |
|---|---|---|
| Credentials | 実装済み | email/password認証（bcryptjs でハッシュ化） |
| Google OAuth | 計画中 | Google アカウント連携 |
| GitHub OAuth | 計画中 | GitHub アカウント連携 |

## セッション管理

- Strategy: **JWT**
- NextAuth session に `userId` を含める
- `src/types/next-auth.d.ts` で型拡張（Session, JWT に userId 追加）

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
  // ビジネスロジック実行
}
```

## クライアント認証

- `SessionProvider` でアプリをラップ（`src/components/providers/`）
- `useSession()` でログイン状態確認
- 未認証ユーザーは `/login` にリダイレクト

```typescript
import { useSession } from 'next-auth/react';

const { data: session, status } = useSession();

if (status === 'loading') {
  // ローディング表示
}

if (status === 'unauthenticated') {
  // /login にリダイレクト
}
```

## ユーザー登録フロー

1. `/register` でメールアドレス・パスワード入力
2. `POST /api/v1/auth/register` → `authService.register()` → bcrypt hash → User作成
3. 自動ログイン → `/onboarding` にリダイレクト

## セキュリティ

| 対象 | 対策 |
|------|------|
| パスワード | bcryptjs でハッシュ化（平文保存禁止） |
| AI APIキー | AES-256-GCM で暗号化してDB保存 |
| セッション | JWT（サーバーサイドで検証） |
| CSRF | NextAuth 組み込み対策 |

## 関連サービス

| サービス | ファイルパス | 主要メソッド |
|---|---|---|
| `authService` | `src/lib/services/authService.ts` | register, verifyPassword |
| `userProfileService` | `src/lib/services/userProfileService.ts` | getProfile, upsertProfile |

## 改訂履歴

| 版数 | 日付 | 内容 | 担当 |
|------|------|------|------|
| 1.0 | 2026-04-02 | 初版作成（テンプレート適用） | Claude Code |
