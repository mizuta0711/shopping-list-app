# API・サービス・リポジトリ・フック対応表

## 概要

API、サービス、リポジトリ、フックの対応関係をまとめた表。フックはクライアント実装後 (Phase 9 タスク #8 以降) に追記する。

---

## 対応表

| API Path | HTTP Methods | 使用ヘルパー / 設定 | データアクセス | 使用フック | 実装Phase |
|----------|--------------|--------------------|--------------|-----------|----------|
| `/api/auth/[...nextauth]` | GET, POST | `handlers` (lib/auth.ts) | Prisma (PrismaAdapter 経由) | (未実装、タスク #9) | Phase 9 |
| `/api/sync/items` | GET | `requireSession`, `SyncPullQuerySchema`, `toDTO` | `prisma.shoppingItem`, `prisma.deletionTombstone` | `useSyncOnMount` → `syncOrchestrator.pullOnce()` → `syncClient.pull()` | Phase 9 |
| `/api/sync/items` | PUT | `requireSession`, `SyncPushSchema`, `toDTO` | `prisma.$transaction` (shoppingItem upsert/delete + deletionTombstone upsert) | `syncOrchestrator` (subscribe + debounce 1.5s) → `syncClient.push()` | Phase 9 |
| `/api/sync/merge` | POST | `requireSession`, `SyncMergeSchema`, `toDTO` | `prisma.$transaction` (shoppingItem upsert + 全件再取得) | `useInitialMerge` → `orchestrator.merge()` → `syncClient.mergeOnLogin()` | Phase 9 |
| `/api/sync/sets` | GET | `requireSession`, `SetsSyncPullQuerySchema`, `setToDTO` | `prisma.shoppingSet`, `prisma.setDeletionTombstone` | `useSyncOnMount` → `syncOrchestrator.pullSetsOnce()` → `syncClient.pullSets()` | Phase 10.1b |
| `/api/sync/sets` | PUT | `requireSession`, `SetsSyncPushSchema`, `setToDTO`, `ensureUnclassifiedList` | `prisma.$transaction` (shoppingSet upsert/delete + setDeletionTombstone upsert + listId 補完) | `syncOrchestrator` (useSetsStore.subscribe + debounce 1.5s) → `syncClient.pushSets()` / `useSetsStore`, `useListsStore` | Phase 10.1b / Phase 10.4 |
| `/api/sync/sets/merge` | POST | `requireSession`, `SetsSyncMergeSchema`, `setToDTO`, `ensureUnclassifiedList` | `prisma.$transaction` (shoppingSet upsert + 全件再取得 + listId 補完) | `useInitialMerge` → `orchestrator.mergeSets()` → `syncClient.mergeSetsOnLogin()` / `useSetsStore` | Phase 10.1b / Phase 10.4 |
| `/api/sync/lists` | GET | `requireSession`, `ListsSyncPullQuerySchema`, `listToDTO` | `prisma.shoppingList`, `prisma.shoppingListDeletionTombstone` | `useSyncOnMount` → `syncOrchestrator.pullListsOnce()` → `syncClient.pullLists()` | Phase 10.2 |
| `/api/sync/lists` | PUT | `requireSession`, `ListsSyncPushSchema`, `listToDTO`, `ensureUnclassifiedList` | `prisma.$transaction` (shoppingList upsert/delete + 所属 items/sets の listId 連鎖更新 + shoppingListDeletionTombstone upsert) | `syncOrchestrator` (useListsStore.subscribe + debounce 1.5s) → `syncClient.pushLists()` / `useListsStore`, `useSetsStore`, `useShoppingStore` | Phase 10.2 / Phase 10.4 |
| `/api/sync/lists/merge` | POST | `requireSession`, `ListsSyncMergeSchema`, `listToDTO`, `ensureUnclassifiedList` | `prisma.$transaction` (shoppingList upsert + 未分類重複統合 → remappedUnclassifiedIds 返却 + 全件再取得) | `useInitialMerge` → `orchestrator.mergeLists()` → `syncClient.mergeListsOnLogin()` / `useListsStore` | Phase 10.2 |

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成。Phase 9 サーバー側 API の対応関係を記載。クライアント側フックは未実装のため後続タスクで追記 | Claude Code |
| 1.1 | 2026-05-05 | (未確定) | Phase 9 タスク #8 完了に伴い、フック列を `useSyncOnMount` / `syncOrchestrator` / `syncClient` で更新 | Claude Code |
| 1.2 | 2026-05-05 | (未確定) | Phase 10.1b でセット同期 API 3 本 (GET/PUT /api/sync/sets, POST /api/sync/sets/merge) の対応関係を追記 | Claude Code |
| 1.3 | 2026-05-06 | 40445ea | Phase 10.4 で sets API 2 本 (PUT /api/sync/sets, POST /api/sync/sets/merge) の使用ヘルパーに `ensureUnclassifiedList` を追記、データアクセスに `listId 補完` を追記、関連フックに `useSetsStore` / `useListsStore` を追加 | Claude Code |
| 1.4 | 2026-05-06 | 4556f4f | sync-check で発見した Phase 10.2 lists API 3 本 (GET/PUT /api/sync/lists, POST /api/sync/lists/merge) の対応表欠落を補正。`useSetsStore.remapListIds` の正確なシグネチャ（Record 形式）をフック一覧に明記 | Claude Code |
