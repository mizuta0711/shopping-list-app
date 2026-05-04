# Stage 2 設計レビュー結果（2回目）— Phase 9 クラウド同期

- 実施日時: 2026-05-04 14:42
- 対象: `docs/features/20260504_phase9-cloud-sync.md` §4 技術設計（Stage 2）v1.3
- モード: tech (Stage 2)
- 使用エージェント: code-reviewer (sonnet)
- 1回目レビュー: `docs/reviews/20260504_141824_design-review-tech-phase9.md`

## 総合判定: ⚠️ 条件付き承認

前回指摘 T1-T19 はすべて反映済みと確認。新規指摘 15 件 (N1-N15) を新たに検出。Critical 4 件（N1-N4）の解消が実装着手の条件。

## 前回指摘の解消状況

T1-T19（19件）すべて設計書 v1.3 に反映済み、内容面で解消確認。

## 新規指摘一覧

| # | 重要度 | カテゴリ | 内容 | 該当箇所 | 推奨対応 | 対応状況 |
|---|--------|---------|------|---------|---------|---------|
| N1 | 🔴 Critical | レスポンス JSON 欠如 | `POST /api/sync/merge` のレスポンス例が「`SyncMergeResponse 参照`」のまま。T3 で PUT は対応したが POST は未対応 | §4-5 POST 末尾 | 具体 JSON 例を追記 | ✅ 対応済み (v1.4) |
| N2 | 🔴 Critical | 型の実質的抜け穴 | `type ShoppingItemDTO = ShoppingItem` は型レベルで同一。T5 の意図（userId 混入防止）が型保護されていない | §4-4 sync.ts | `Omit<ShoppingItem, "userId">` に変更 + `userId` がそもそも FE 型にない理由を併記、または branded type 検討 | ✅ 対応済み (v1.4) |
| N3 | 🔴 Critical | GET の Zod スキーマ欠如 | PUT のみ Zod 記載、GET の `since` バリデーション仕様なし | §4-5 GET 節 | `SyncPullQuerySchema = z.object({ since: z.string().datetime().optional() })` 追記 | ✅ 対応済み (v1.4) |
| N4 | 🔴 Critical | POST の Zod スキーマ欠如 | `localItems` のバリデーション仕様なし | §4-5 POST 節 | `SyncMergeSchema` 追記、`ShoppingItemSchema` 再利用を明示 | ✅ 対応済み (v1.4) |
| N5 | 🟡 Major | DeletionTombstone unique 制約と再削除 | 削除→再作成→再削除で `@@unique` 違反。upsert か insert-or-ignore の指示なし | §4-1, §4-5 PUT ステップ3 | 「`upsert({ where: {userId_itemId}, create, update: { deletedAt: now() } })`」と明記 | ✅ 対応済み (v1.4) |
| N6 | 🟡 Major | subscribe の prevSnapshot がモジュールスコープ | HMR で二重購読、SSR で破綻リスク | §4-6 擬似コード | factory 関数化 + クライアント専用ガード明記 | ✅ 対応済み (v1.4) |
| N7 | 🟡 Major | useLocalStorage キー切替時の挙動未定義 | null → 有効値切替時に `hasMerged === undefined` の隙間で二重マージリスク | §4-9 | 戻り値型 + `null` キー時の返却値を明記、`if (hasMerged === true) return` ガード | ✅ 対応済み (v1.4) |
| N8 | 🟡 Major | useLocalStorage 実装仕様欠如 | SSR ガード、容量超過、parse 失敗の扱いなし | §4-6, §4-9 | シグネチャと実装方針を追記 | ✅ 対応済み (v1.4) |
| N9 | 🟡 Major | DTO 型の使用が一貫していない | `SyncPushResponse` 系は `ShoppingItem[]` のまま、`SyncPullResponse` のみ `ShoppingItemDTO[]` | §4-4 sync.ts | 全レスポンスを `ShoppingItemDTO[]` に統一 | ✅ 対応済み (v1.4) |
| N10 | 🟡 Major | GET と PUT の since 対称性不完全 | GET で `?since=null` や不正文字列の挙動が未定義 | §4-5 | Zod バリデーション挙動 (400/INVALID_INPUT) を明記 | ✅ 対応済み (v1.4) |
| N11 | 🟡 Major | userId 混入の防御明示なし | クライアントが userId を payload に混入させた場合の防御未記述 | §4-5 PUT Zod | スキーマで userId を明示的に拒否、`{ ...input, userId: session.user.id }` での上書きを明記 | ✅ 対応済み (v1.4) |
| N12 | 🟢 Minor | §4-12 に sync-helpers.ts 不在 | §4-3 で設計済みだが新規ファイルリストに未記載 | §4-12 | 追記 | ✅ 対応済み (v1.4) |
| N13 | 🟢 Minor | §4-12 に useLocalStorage.ts 不在 | 「`src/features/sync/` 一式」では曖昧 | §4-12 | 明示的に追記 | ✅ 対応済み (v1.4) |
| N14 | 🟢 Minor | §4-13 実装順序の表現が弱い | 「文言更新」では二択 UI 追加が伝わらない | §4-13 ステップ11 | 「最終ステップへの二択ボタン追加」に改訂 | ✅ 対応済み (v1.4) |
| N15 | 🟢 Minor | §4-14 対応欄が古い | 「順次反映予定」のまま | §4-14 | 「全19件反映済み（v1.3）。再レビュー実施中」に更新 | ✅ 対応済み (v1.4) |

## 次アクション

1. ✅ ユーザー承認得済み（A 案: 全件反映 + 3回目レビュースキップ）
2. ✅ N1-N15 全件反映完了（設計書 v1.4）
3. ユーザー目視確認 → 実装フェーズへ
