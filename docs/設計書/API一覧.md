# API一覧

## 概要

プロジェクトの API エンドポイント一覧。

**共通仕様:**
- 認証: Auth.js v5 (next-auth@beta)。`/api/sync/*` は認証必須
- リクエストバリデーション: Zod (各 route で `safeParse`)
- レスポンス形式: `{ success: boolean, data?: any, error?: { code: string, message: string, fields?: Record<string, string> } }`
- API パスバージョニング: Phase 9 時点では `v1` プレフィクスなし
- 共通エラーコード:
  - `UNAUTHORIZED` (401): 未ログイン or セッション失効
  - `INVALID_INPUT` (400): Zod バリデーションエラー
  - `INTERNAL_ERROR` (500): サーバー内部エラー

---

## 1. 認証 API (Auth.js v5 標準)

| メソッド | パス | 説明 | 実装Phase |
|---------|------|------|----------|
| GET / POST | `/api/auth/[...nextauth]` | Auth.js v5 統合エンドポイント (signIn / signOut / callback / session 等) | Phase 9 |

### `/api/auth/[...nextauth]`

Auth.js v5 の `handlers` を `src/lib/auth.ts` から re-export。Google OAuth provider + Database session 戦略。

リクエスト/レスポンスは Auth.js 標準仕様に準拠。詳細は [Auth.js 公式ドキュメント](https://authjs.dev) を参照。

---

## 2. クラウド同期 API

| メソッド | パス | 説明 | 認証 | 実装Phase |
|---------|------|------|------|----------|
| GET | `/api/sync/items` | 全件 / 差分取得 | 必須 | Phase 9 |
| PUT | `/api/sync/items` | 楽観的更新 (push + LWW + 他端末差分取得) | 必須 | Phase 9 |
| POST | `/api/sync/merge` | 初回ログイン時のローカル全件マージ | 必須 | Phase 9 |
| GET | `/api/sync/sets` | セット全件 / 差分取得 | 必須 | Phase 10.1b |
| PUT | `/api/sync/sets` | セット楽観的更新 (push + LWW + 他端末差分取得) | 必須 | Phase 10.1b |
| POST | `/api/sync/sets/merge` | 初回ログイン時のセットローカル全件マージ | 必須 | Phase 10.1b |

### `GET /api/sync/items`

サーバー側の買い物アイテムを取得。`since` 指定時は差分のみ。

**クエリパラメータ:**
- `since` (string, optional): ISO 8601 日時。指定時は `updatedAt > since` のアイテムのみ返す

**Zod スキーマ:**
```ts
z.object({ since: z.string().datetime().optional() })
```

**リクエスト例:**
```
GET /api/sync/items?since=2026-05-04T10:00:00.000Z
```

**レスポンス例 (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "0a3e8c2b-aaaa-4bbb-8ccc-111111111111",
        "name": "牛乳",
        "scope": "TODAY",
        "status": "PENDING",
        "order": 0,
        "createdAt": "2026-05-04T09:50:00.000Z",
        "updatedAt": "2026-05-04T10:05:00.000Z",
        "purchasedAt": null
      }
    ],
    "serverDeletes": ["c3d4e5f6-bbbb-4ccc-8ddd-222222222222"],
    "serverTime": "2026-05-04T10:30:00.123Z",
    "lastUpdatedAt": "2026-05-04T10:05:00.000Z"
  }
}
```

### `PUT /api/sync/items`

debounce 後にローカル変更をまとめて送信。サーバーは LWW 判定 + 他端末差分を返す。

**Zod スキーマ:**
```ts
const ShoppingItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  scope: z.enum(["TODAY", "LATER"]),
  status: z.enum(["PENDING", "PURCHASED"]),
  order: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  purchasedAt: z.string().datetime().nullable(),
}).strict(); // userId 等の余分フィールドを 400 で拒否

z.object({
  upserts: z.array(ShoppingItemSchema).max(500),
  deletedIds: z.array(z.string().uuid()).max(500),
  since: z.string().datetime().nullable(),
}).strict();
```

**リクエスト例:**
```json
{
  "upserts": [
    {
      "id": "0a3e8c2b-aaaa-4bbb-8ccc-111111111111",
      "name": "牛乳",
      "scope": "TODAY",
      "status": "PURCHASED",
      "order": 0,
      "createdAt": "2026-05-04T09:50:00.000Z",
      "updatedAt": "2026-05-04T10:35:12.000Z",
      "purchasedAt": "2026-05-04T10:35:12.000Z"
    }
  ],
  "deletedIds": ["b1d2c3e4-aaaa-4bbb-8ccc-333333333333"],
  "since": "2026-05-04T10:00:00.000Z"
}
```

**レスポンス例 (200):**
```json
{
  "success": true,
  "data": {
    "applied": [ /* 書き込まれた最新アイテム */ ],
    "rejected": [
      {
        "id": "...",
        "reason": "SERVER_NEWER",
        "serverItem": { /* クライアントが採用すべき最新版 */ }
      }
    ],
    "serverChanges": [ /* since 以降の他端末からの変更 */ ],
    "serverDeletes": ["dead0001-..."],
    "serverTime": "2026-05-04T10:36:01.456Z",
    "lastUpdatedAt": "2026-05-04T10:36:00.000Z"
  }
}
```

**サーバー処理の要点:**
1. `requireSession()` で userId 取得
2. Zod バリデーション（`.strict()` で userId 偽装拒否）
3. トランザクション内で:
   - `upserts`: LWW 判定 (`existing.updatedAt >= input.updatedAt` ならスキップして `rejected` に積む)。upsert 時は必ず `userId: session.user.id` で上書き
   - `deletedIds`: `WHERE userId AND id IN (...)` で削除 + `DeletionTombstone.upsert({ deletedAt: now })`
   - 他端末差分: `serverChanges` (updatedAt > since)、`serverDeletes` (DeletionTombstone.deletedAt > since)

### `POST /api/sync/merge`

初回ログイン時にローカル既存データをサーバーへマージ。`uploadedCount` / `downloadedCount` を返してトースト表示に使う。

**Zod スキーマ:**
```ts
z.object({
  localItems: z.array(ShoppingItemSchema).max(500),
}).strict();
```

**リクエスト例:**
```json
{
  "localItems": [
    {
      "id": "0a3e8c2b-aaaa-4bbb-8ccc-111111111111",
      "name": "牛乳",
      "scope": "TODAY",
      "status": "PENDING",
      "order": 0,
      "createdAt": "2026-05-04T09:50:00.000Z",
      "updatedAt": "2026-05-04T09:50:00.000Z",
      "purchasedAt": null
    }
  ]
}
```

**レスポンス例 (200):**
```json
{
  "success": true,
  "data": {
    "finalItems": [ /* マージ後の全件 */ ],
    "uploadedCount": 2,
    "downloadedCount": 1,
    "serverTime": "2026-05-04T10:40:00.789Z",
    "lastUpdatedAt": "2026-05-04T09:51:00.000Z"
  }
}
```

### `GET /api/sync/sets`

サーバー側のセットを取得。`since` 指定時は差分のみ。

**クエリパラメータ:**
- `since` (string, optional): ISO 8601 日時。指定時は `updatedAt > since` のセットのみ返す

**Zod スキーマ:**
```ts
z.object({ since: z.string().datetime().optional() })
```

**リクエスト例:**
```
GET /api/sync/sets?since=2026-05-05T07:00:00.000Z
```

**レスポンス例 (200):**
```json
{
  "success": true,
  "data": {
    "sets": [
      {
        "id": "uuid-1",
        "name": "カレーセット",
        "items": ["玉ねぎ", "じゃがいも", "カレールー"],
        "createdAt": "2026-05-04T12:00:00.000Z",
        "updatedAt": "2026-05-05T08:00:00.000Z"
      }
    ],
    "serverDeletes": ["uuid-2"],
    "serverTime": "2026-05-05T10:00:00.000Z",
    "lastUpdatedAt": "2026-05-05T08:00:00.000Z"
  }
}
```

**サーバー処理の要点:**
- `since` 未指定なら全セット取得 / 指定時は `updatedAt > since` のみ
- `serverDeletes` は `SetDeletionTombstone.deletedAt > since` の `setId` 配列
- `lastUpdatedAt` はクライアントが次回 `since` として使う基準時刻（最新 `updatedAt` または `serverTime`）

### `PUT /api/sync/sets`

debounce 後にローカルのセット変更をまとめて送信。サーバーは LWW 判定 + 他端末差分を返す。

**Zod スキーマ:**
```ts
const ShoppingSetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  items: z.array(z.string()).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict(); // userId 等の余分フィールドを 400 で拒否

z.object({
  upserts: z.array(ShoppingSetSchema).max(500),
  deletedIds: z.array(z.string().uuid()).max(500),
  since: z.string().datetime().nullable(),
}).strict();
```

**リクエスト例:**
```json
{
  "upserts": [
    {
      "id": "uuid-1",
      "name": "カレーセット",
      "items": ["玉ねぎ", "じゃがいも", "カレールー"],
      "createdAt": "2026-05-04T12:00:00.000Z",
      "updatedAt": "2026-05-05T08:00:00.000Z"
    }
  ],
  "deletedIds": ["uuid-2"],
  "since": "2026-05-05T07:00:00.000Z"
}
```

**レスポンス例 (200):**
```json
{
  "success": true,
  "data": {
    "applied": [ /* 書き込まれた最新セット */ ],
    "rejected": [
      {
        "id": "...",
        "reason": "SERVER_NEWER",
        "serverSet": { /* クライアントが採用すべき最新版 */ }
      }
    ],
    "serverChanges": [ /* since 以降の他端末からの変更 */ ],
    "serverDeletes": ["uuid-dead-0001"],
    "serverTime": "2026-05-05T10:36:01.456Z",
    "lastUpdatedAt": "2026-05-05T10:36:00.000Z"
  }
}
```

**サーバー処理の要点:**
1. `requireSession()` で userId 取得
2. Zod バリデーション（`.strict()` で userId 偽装拒否）
3. `prisma.$transaction` 内で:
   - `upserts`: LWW 判定 (`existing.updatedAt >= input.updatedAt` ならスキップして `rejected` に積む)。upsert 時は必ず `userId: session.user.id` で上書き
   - `deletedIds`: `WHERE userId AND id IN (...)` で削除 + `SetDeletionTombstone.upsert({ deletedAt: now })`
   - 他端末差分: `serverChanges` (updatedAt > since)、`serverDeletes` (SetDeletionTombstone.deletedAt > since)

### `POST /api/sync/sets/merge`

初回ログイン時にローカルの既存セットをサーバーへマージ。`uploadedCount` / `downloadedCount` を返してトースト表示に使う。

**Zod スキーマ:**
```ts
z.object({
  localSets: z.array(ShoppingSetSchema).max(500),
}).strict();
```

**リクエスト例:**
```json
{
  "localSets": [
    {
      "id": "uuid-1",
      "name": "カレーセット",
      "items": ["玉ねぎ", "じゃがいも", "カレールー"],
      "createdAt": "2026-05-04T12:00:00.000Z",
      "updatedAt": "2026-05-04T12:00:00.000Z"
    }
  ]
}
```

**レスポンス例 (200):**
```json
{
  "success": true,
  "data": {
    "finalSets": [ /* マージ後の全セット */ ],
    "uploadedCount": 1,
    "downloadedCount": 2,
    "serverTime": "2026-05-05T10:40:00.789Z",
    "lastUpdatedAt": "2026-05-05T08:00:00.000Z"
  }
}
```

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成。Phase 9 のクラウド同期 API 3 エンドポイント (GET/PUT /api/sync/items, POST /api/sync/merge) と Auth.js v5 統合エンドポイントを記載 | Claude Code |
| 1.1 | 2026-05-05 | (未確定) | Phase 10.1b でセット同期 API 3 本 (GET/PUT /api/sync/sets, POST /api/sync/sets/merge) を追加。Zod スキーマ・リクエスト/レスポンス例を記載 | Claude Code |
