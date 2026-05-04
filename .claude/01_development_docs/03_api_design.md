# API設計

## 共通仕様

- **認証**: Auth.js v5 (`next-auth@beta`)。`/api/sync/*` 等の保護エンドポイントは `requireSession()` で 401 早期 return
- **バリデーション**: Zod (`safeParse` で型安全に検証、`.strict()` で余分フィールドを 400 拒否)
- **レスポンス形式**:
  ```json
  { "success": true, "data": { ... } }
  { "success": false, "error": { "code": "ERROR_CODE", "message": "...", "fields": { "email": "..." } } }
  ```
- **ページネーション**: カーソルベース（`cursor`, `limit` パラメータ）。同期 API のように全件 / 差分取得型のものは `since` (ISO 8601) を使用
- **エラーコード**: `UNAUTHORIZED` (401) / `INVALID_INPUT` (400) / `INTERNAL_ERROR` (500)

---

## API パスバージョニング方針

**Phase 9 時点では `v1` プレフィクスを採用しない**。プロジェクト全体で `/api/{feature}/{action}` 形式 (例: `/api/sync/items`) で統一する。将来 v2 が必要になった時点で全 API への `/v1/` 一括導入とリダイレクトを検討する。

---

## API ディレクトリ構成

```
src/app/api/
├── auth/
│   └── [...nextauth]/
│       └── route.ts        # Auth.js v5 統合エンドポイント
└── sync/
    ├── items/
    │   └── route.ts        # GET (差分取得) / PUT (push + LWW)
    └── merge/
        └── route.ts        # POST (初回ログイン時マージ)
```

---

## 個別エンドポイント定義

実装中の個別エンドポイントの一覧・リクエスト/レスポンス JSON 例は **`docs/設計書/API一覧.md`** を参照。本ドキュメントは設計ルールのみを扱う。

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | Phase 9 実装に合わせて更新。Auth.js v5 採用、API パスバージョニング方針 (v1 なし)、ディレクトリ構成、エラーコード一覧を記載 | Claude Code |
