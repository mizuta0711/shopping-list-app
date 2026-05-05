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
| `/api/sync/sets` | PUT | `requireSession`, `SetsSyncPushSchema`, `setToDTO` | `prisma.$transaction` (shoppingSet upsert/delete + setDeletionTombstone upsert) | `syncOrchestrator` (useSetsStore.subscribe + debounce 1.5s) → `syncClient.pushSets()` | Phase 10.1b |
| `/api/sync/sets/merge` | POST | `requireSession`, `SetsSyncMergeSchema`, `setToDTO` | `prisma.$transaction` (shoppingSet upsert + 全件再取得) | `useInitialMerge` → `orchestrator.mergeSets()` → `syncClient.mergeSetsOnLogin()` | Phase 10.1b |

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成。Phase 9 サーバー側 API の対応関係を記載。クライアント側フックは未実装のため後続タスクで追記 | Claude Code |
| 1.1 | 2026-05-05 | (未確定) | Phase 9 タスク #8 完了に伴い、フック列を `useSyncOnMount` / `syncOrchestrator` / `syncClient` で更新 | Claude Code |
| 1.2 | 2026-05-05 | (未確定) | Phase 10.1b でセット同期 API 3 本 (GET/PUT /api/sync/sets, POST /api/sync/sets/merge) の対応関係を追記 | Claude Code |
