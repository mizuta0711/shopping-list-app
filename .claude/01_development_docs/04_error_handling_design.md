# エラーハンドリング設計

## 概要

全レイヤーにわたるエラーハンドリングの統一的な設計方針。`src/lib/api/` に共通基盤を実装済み。

---

## 1. ファイル構成

```
src/lib/api/
├── errors.ts     — ApiError, ApiValidationError クラス, ErrorCode型
├── handler.ts    — withAuth(), withPublic() ラッパー
├── response.ts   — successResponse(), errorResponse() ヘルパー
├── validation.ts — validateBody(), validateQuery() Zodバリデーション
└── index.ts      — 一括エクスポート
```

---

## 2. エラークラス階層

```typescript
// ErrorCode型
type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "AI_SERVICE_ERROR"
  | "INTERNAL_ERROR";

// 基底エラークラス
class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// バリデーションエラー（フィールド別詳細付き）
class ApiValidationError extends ApiError {
  public readonly fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string>) {
    super("VALIDATION_ERROR", message, 400);
    this.name = "ApiValidationError";
    this.fields = fields;
  }
}
```

---

## 3. APIエラーレスポンス形式

### 成功レスポンス

```json
{ "success": true, "data": { ... } }
```

### エラーレスポンス

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "fields": {
      "email": "有効なメールアドレスを入力してください"
    }
  }
}
```

- `fields` はバリデーションエラー時（`ApiValidationError`）のみ含まれる

### エラーコードとHTTPステータスマッピング

| コード | HTTP Status | 説明 | 発生シーン |
|--------|-------------|------|-----------|
| `UNAUTHORIZED` | 401 | 認証が必要 | セッション未取得・期限切れ |
| `FORBIDDEN` | 403 | アクセス権がない | 他ユーザーのリソースアクセス |
| `NOT_FOUND` | 404 | リソースが見つからない | 存在しないID指定 |
| `VALIDATION_ERROR` | 400 | バリデーションエラー | Zod検証失敗 |
| `CONFLICT` | 409 | リソースの競合 | メールアドレス重複 |
| `AI_SERVICE_ERROR` | 502 | AI API呼び出しエラー | AI応答パース失敗・タイムアウト |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー | 予期しないエラー |

---

## 4. APIルートハンドラーパターン（withAuth / withPublic）

### 認証必須ルート

```typescript
import { withAuth, validateBody, successResponse } from "@/lib/api";

export const GET = withAuth(async (req, { params, userId }) => {
  const data = await someService.getData(userId);
  return successResponse(data);
});

export const POST = withAuth(async (req, { params, userId }) => {
  const body = await validateBody(req, createSchema);
  const result = await someService.create(userId, body);
  return successResponse(result, 201);
});
```

### 認証不要ルート（登録等）

```typescript
import { withPublic, validateBody, successResponse } from "@/lib/api";

export const POST = withPublic(async (req, { params }) => {
  const body = await validateBody(req, registerSchema);
  const result = await authService.register(body);
  return successResponse(result, 201);
});
```

### withAuth/withPublic の自動エラーハンドリング

ハンドラー内で throw されたエラーは `handleError()` で自動キャッチされる:

| throw されるエラー | レスポンス | HTTP Status |
|-------------------|-----------|-------------|
| `ApiValidationError` | `{ success: false, error: { code: "VALIDATION_ERROR", message, fields } }` | 400 |
| `ApiError` | `{ success: false, error: { code, message } }` | `error.statusCode` |
| その他の `Error` | `{ success: false, error: { code: "INTERNAL_ERROR", message } }` | 500 |

**重要**: 個別の API Route で try-catch を書く必要はない。`withAuth`/`withPublic` が全てのエラーを捕捉する。

---

## 5. バリデーションパターン

### リクエストボディ

```typescript
// validateBody は内部で request.json() + Zod safeParse を実行
// 失敗時は自動で ApiValidationError を throw
const body = await validateBody(req, createSessionSchema);
```

### クエリパラメータ

```typescript
// URLSearchParams を Record<string, string> に変換して Zod で検証
const query = validateQuery(req.nextUrl.searchParams, listQuerySchema);
```

### バリデーションエラーのフィールド形式

Zod の `issues` からフィールドパスをキーとしたエラーメッセージを自動生成:

```json
{
  "fields": {
    "email": "有効なメールアドレスを入力してください",
    "password": "8文字以上で入力してください"
  }
}
```

---

## 6. サービス層でのエラー発生

サービス層では `ApiError` を throw する。`withAuth`/`withPublic` が自動でキャッチしてレスポンスに変換する。

```typescript
// サービス内での使用例
throw new ApiError("NOT_FOUND", "セッションが見つかりません", 404);
throw new ApiError("FORBIDDEN", "このリソースへのアクセス権がありません", 403);
throw new ApiError("AI_SERVICE_ERROR", "AI応答の解析に失敗しました", 502);
throw new ApiError("CONFLICT", "このメールアドレスは既に登録されています", 409);
```

---

## 7. AI応答エラーハンドリング

### AI応答パース（3段階フォールバック）

```
1. JSON抽出（正規表現） → 2. Zodバリデーション → 3. フォールバック応答
```

#### 実装パターン

```typescript
export function parseAIResponse<T>(rawResponse: string, schema: z.ZodType<T>): T {
  try {
    // Step 1: JSONブロックを抽出（```json ... ``` で囲まれている場合も対応）
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON not found in AI response");
    }

    // Step 2: JSONパース + Zodバリデーション
    const parsed = JSON.parse(jsonMatch[0]);
    return schema.parse(parsed);
  } catch (error) {
    // Step 3: パース失敗 → エラーを投げる（呼び出し元でフォールバック処理）
    console.error("AI response parse error:", error);
    throw new ApiError("AI_SERVICE_ERROR", "AI応答の解析に失敗しました", 502);
  }
}
```

### フォールバックシステム

AI呼び出しが失敗した場合、既存の `fallback.ts` のロジックを活用してモック応答を返す。

```typescript
// aiCallWrapper.ts
export async function callAIWithRetry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; timeoutMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 30000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI call timeout")), timeoutMs)
        ),
      ]);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // 指数バックオフ
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Unreachable");
}

// フォールバック応答
export function getFallbackResponse(type: "light" | "deep" | "quiz"): FallbackResponse {
  // ユーザーには「ポチが少し疲れているみたい。もう一度試してね」のようなメッセージを表示
}
```

---

## 8. クライアントサイドエラーハンドリング

### カスタムフック内での ApiResponse チェック

```typescript
// ApiResponse型に基づいてエラーを判定
const json: ApiResponse<T> = await res.json();
if (!json.success) {
  setError(json.error?.message || "エラーが発生しました");
  return null;
}
return json.data;
```

### データ取得フックでのパターン

```typescript
function useKnowledgeList(options?: KnowledgeListOptions) {
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const response = await api.get("/api/v1/knowledge", { params: options });
      if (!response.data.success) {
        setError(response.data.error.message);
        return;
      }
      setData(response.data.data.knowledges);
    } catch (e) {
      setError("通信エラーが発生しました");
    }
  }, [options]);

  return { data, loading, error, refetch: fetch };
}
```

### エラー表示コンポーネント

```typescript
interface ErrorMessageProps {
  message: string | null;
}

export const ErrorMessage = memo<ErrorMessageProps>(({ message }) => {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
      {message}
    </div>
  );
});
```

---

## 9. トークン管理

### コンテキストウィンドウの管理

チャット履歴が長くなった場合のトークン管理戦略:

1. セッション内メッセージは**最大20件**をAIに送信
2. 20件を超える場合、古いメッセージを要約して先頭に付与
3. ユーザーコンテキスト + ナレッジ情報は常に含める
4. 推定トークン数の上限: 入力4,000トークン（Claudeの場合）

### トークン推定

```typescript
// 簡易トークン推定（日本語は1文字≒1.5トークン）
export function estimateTokens(text: string): number {
  const japaneseChars = (text.match(/[\u3000-\u9fff]/g) || []).length;
  const otherChars = text.length - japaneseChars;
  return Math.ceil(japaneseChars * 1.5 + otherChars * 0.25);
}
```

---

## 10. エラーハンドリングチェックリスト

### API Route実装時
- [ ] `withAuth` または `withPublic` ラッパーを使用（手動try-catch不要）
- [ ] `validateBody` / `validateQuery` でZodバリデーション
- [ ] サービス層で `ApiError` を throw
- [ ] `successResponse()` で成功レスポンスを返却
- [ ] 個別の try-catch は書かない（withAuth/withPublic に任せる）

### AI連携実装時
- [ ] タイムアウト設定（30秒）
- [ ] リトライ（指数バックオフ最大2回）
- [ ] JSON抽出 → Zodバリデーション
- [ ] フォールバック応答の用意
- [ ] トークン数管理（20メッセージ上限）

### クライアント実装時
- [ ] error state管理（useState）
- [ ] ローディング状態表示
- [ ] `ApiResponse<T>` の `success` フィールドでエラー判定
- [ ] ネットワークエラーのハンドリング（catch句）
- [ ] エラーメッセージ表示コンポーネント

---

## 改訂履歴

| 版数 | 日付 | 内容 | 担当 |
|------|------|------|------|
| 1.0 | 2026-04-02 | 初版作成（docs/から移行） | Claude Code |
| 1.1 | 2026-04-02 | 実装済みパターン（withAuth/withPublic、validateBody/validateQuery）に基づき全面更新。ファイル構成・エラークラス階層・バリデーションパターン・サービス層エラー発生パターンを追加 | Claude Code |
