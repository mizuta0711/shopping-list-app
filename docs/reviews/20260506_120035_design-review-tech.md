# Stage 2 設計レビュー結果

- 実施日時: 2026-05-06 12:00
- 対象: docs/features/20260506_phase10.4-set-list-binding.md §4
- モード: tech (Stage 2)

## 総合判定: ❌ 差し戻し → ✅ 反映済み

## code-reviewer

| # | 重要度 | 内容 | 対象 | 対応状況 |
|---|--------|------|------|---------|
| 1 | 高 | items 型不整合（ShoppingSetItemDTO[] ではなく string[]）| §4-3 / §4-4-1,2 | ✅ string[] に修正。ShoppingSetItemDTO 参照を削除 |
| 2 | 高 | merge レスポンスキー誤り（`sets` ではなく `finalSets`）| §4-4-2 | ✅ `finalSets` に修正。SetsSyncMergeResponse 型と整合 |
| 3 | 高 | applyListDeleted の moved フィルタが set() 後で誤り（未分類 ID でフィルタしており移動前に絞り込めない）| §4-6-2 | ✅ set() 前に toMove を取得するパターンに修正 |
| 4 | 高 | ファイルパスが全て `src/features/sets/` と記載されているが実態は `src/features/shopping/` | §4-1 / §4-9 等 全体 | ✅ 全箇所を `src/features/shopping/` に置換 |
| 5 | 高 | Zod スキーマ参照先が `sync-helpers.ts` と記載されているが実態は `sync-schemas.ts` | §4-3 | ✅ `sync-schemas.ts` に修正 |
| 6 | 中 | items フィールドの Zod スキーマ維持を明示していない | §4-3 | ✅ `z.array(z.string().min(1).max(50)).max(100)` 維持と明記 |
| 7 | 中 | `setToDTO` の `listId` 追加を §4-1 に明記していない | §4-1 / §4-13 | ✅ dto.ts の変更内容と受け入れ条件に追記 |
| 8 | 中 | `useInitialMerge.ts` のローカル `setToDTO` も `listId` を含む形に修正必要 | §4-8 | ✅ setToDTO ローカル関数の修正を追記 |
| 9 | 中 | §4-13 に設計書更新項目が未記載 | §4-13 | ✅ 設計書更新セクションを追加 |
| 10 | 中 | §4-9 の migrate コールバックの型シグネチャが Phase 10.2 パターンと不統一 | §4-9 | ✅ `(persistedState: unknown, version: number): SetsState` シグネチャに統一。v1 ガード関数シグネチャも明示 |
| 11 | 低 | §4-6-3 の `throw new Error` が §4-12 エラー処理方針と不整合 | §4-6-3 | ✅ `console.error` + early return に修正 |
| 12 | 低 | §4-1 の変更ファイル一覧に `ShoppingMainView.tsx` が未記載（`src/app/page.tsx` で記載）| §4-1 | ✅ `src/features/shopping/components/ShoppingMainView.tsx` に修正 |
