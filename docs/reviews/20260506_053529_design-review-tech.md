# Stage 2 設計レビュー結果

- 実施日時: 2026-05-06 05:35
- 対象: `docs/features/20260505_phase10.2-stores.md` §4「技術設計（Stage 2）」
- モード: tech (Stage 2)

## 総合判定: ⚠️ 条件付き承認

高 6 件 / 中 6 件 / 低 3 件 = 計 15 件。実装着手前に **高優先度 6 件** の修正が必要。特に T2（system list の partial unique 制約 / 競合時の例外処理）、T6（`pendingListIds` の upsert/delete 分離）、T3（upsert の userId 所有権チェック）は安全性・一貫性に直結。

## code-reviewer（API・DB・サービス・ストア整合性）

### 要修正一覧

| # | 重要度 | 内容 | 対象 | 推奨対応 |
|---|--------|------|------|---------|
| **T1** | **高** | Zod バリデーションスキーマが lists 系 API 3 本すべてで未定義。既存 ShoppingItemSchema / ShoppingSetSchema は `.strict()` 明記されているが lists 版は記載なし | §4-4-1〜4-4-3 | `ShoppingListSchema = z.object({...}).strict()` と `ListsSyncPushSchema` (`upserts.max(50)`, `deletedIds.max(50)`)、`ListsSyncMergeSchema` (`localLists.max(50)`, `localUnclassifiedId`) を §4-4 各節に明記する |
| **T2** | **高** | `system: true` の partial unique 制約が「検討」止まり。Prisma `create` は `ON CONFLICT DO NOTHING` を発行しないため、同時リクエストで例外が発生する。`ensureUnclassifiedList` の競合吸収方針が矛盾している | §4-5 | migration.sql に `CREATE UNIQUE INDEX ... ON "ShoppingList" ("userId") WHERE "system" = TRUE` を**確定**で追加。`ensureUnclassifiedList` を Prisma `upsert` または raw SQL `INSERT ... ON CONFLICT DO NOTHING ... RETURNING *` に変更し、設計書の「検討」記述を確定に変更 |
| **T3** | **高** | `PUT /api/sync/lists` の upsert 擬似コードに `existing.userId !== userId` の所有権チェックが欠落。ID 衝突した他ユーザーのリストを上書きできる脆弱性 | §4-4-2 擬似コード | upsert ループの冒頭に `if (existing && existing.userId !== userId) { continue; }` を追加 |
| **T4** | **高** | 4-1 ファイル表は `POST /api/sync/merge` を「listId 補完で変更」としているが、§4-4 の各節に該当の変更詳細がない（§4-4-4 は items の `PUT` のみ） | §4-4 | §4-4-4b として「`POST /api/sync/merge` (items merge) の listId 補完」を追記 |
| **T5** | **高** | `useInitialMerge` の方針が§4-1（「lists も並列マージ」）と§4-8（「lists を先行直列 → items + sets を並列」）で矛盾 | §4-1 / §4-8 | §4-1 の説明を「lists を先行直列マージ後、items と sets を並列マージ」に修正 |
| **T6** | **高** | `pendingListIds: Set<string>` という単一 Set の設計が、Phase 10.1b の `pendingSetUpsertIds` / `pendingSetDeleteIds` パターンに対して非対称。upsert と delete を区別できず `pushPendingListsNow` が破綻する | §4-6-4 / §4-7 | sets と同じ `pendingListUpsertIds: Set<string>` + `pendingListDeleteIds: Set<string>` + `lastListsUpdatedAt: string \| null` + 対応アクション（`markListUpsert / markListDelete / consumeListPending / setLastListsUpdatedAt`）を追加 |
| **T7** | **中** | `activeListId` が削除済みリストを指す場合の自動フォールバック（→未分類）が§4-6-3 ストア設計に未定義。Stage 1 §3-5 では明記済みだが Stage 2 で実装ポイントが宙に浮いている | §4-6-3 / §4-7 | `pullListsOnce` または `applyServerChanges` 中で `activeListId` が tombstone リストを指していたら未分類へ切り替えるロジックを追記 |
| **T8** | **中** | `listToDTO()` の関数定義（追加先 = `src/lib/api/dto.ts`）が設計書に明記されていない。Phase 9/10.1b には対応する `toDTO` / `setToDTO` の追加が記載されていた | §4-3 / §4-5 | 4-1 のファイル変更表と§4-5 で `src/lib/api/dto.ts` への `listToDTO()` 追加を明記 |
| **T9** | **中** | `GET /api/sync/lists` で「未分類が存在しなければ自動作成」とあるが、GET でのサイドエフェクトは原則違反 + T2 の競合問題が顕在化する | §4-4-1 | GET での自動生成を廃止し、初回保証は migration.sql + `POST /api/sync/lists/merge` に集約 |
| **T10** | **中** | `migrateShoppingV2ToV3` 内の `isV2()` 型ガードの実装条件が未定義 | §4-9 | `isV2(persisted: unknown): persisted is V2State` の判定条件（version フィールド + items 配列に listId が無いこと等）を追記 |
| **T11** | **中** | §4-8 で呼ばれる `useShoppingStore.remapListIds` が§4-6-2 のアクション一覧に存在しない | §4-6-2 | `remapListIds(fromIds: string[], toId: string): void` をアクション一覧に追加 |
| **T12** | **中** | §4-13 受け入れ条件の同期欄に「items / sets / lists が並列マージされ」と書かれており、§4-8 の正しい順序「lists 先行 → items + sets 並列」と矛盾 | §4-13 | 「初回ログイン時: lists を先行マージ → items / sets を並列マージ。通常 push は lists → items → sets の直列」に修正 |
| **T13** | **低** | §4-12 エラー処理の「移動先リスト削除時にサーバーが警告フラグを返す」が型定義にない未定義 API 拡張 | §4-12 | 「クライアントが存在しない listId で items を push → サーバーが未分類に補完」という listId 補完ロジックでの吸収に整理。「警告フラグ」記述を削除 |
| **T14** | **低** | `useListsStore.deleteList` で `applyListDeleted` の呼び出しが「呼び出し側責務」と曖昧。コンポーネント側の呼び出し漏れで listId 孤立リスク | §4-6-1 | `deleteList` アクション内で `applyListDeleted` を直接呼ぶ（責務をアクションに閉じる）よう修正 |
| **T15** | **低** | サービス層 `listSyncService.ts` を新設する方針が、`サービス・リポジトリ一覧.md` の「Phase 9 では Repository 層を作らず route から直接 prisma を呼ぶ」方針と乖離。方針変更の明示的記録なし | §4-5 / サービス一覧.md | 方針変更の注釈をサービス一覧.md に追記、または lists も既存パターンに統一 |

## 設計書間の矛盾

| # | 内容 |
|---|------|
| 1 | **サービス一覧.md** との方針乖離（T15）。Phase 10.2 で初めて Service 層を導入 |
| 2 | **フック一覧.md** との不整合（T6）。10.1b の pending 分離設計を 10.2 が単一 Set に退行 |
| 3 | **API一覧.md**: lists 系 3 本が未掲載（実装時追記としているが、設計レビュー時点で先行掲載が望ましい）|

## 既存 Phase 9 / 10.1b パターンとの整合性懸念

| # | 内容 |
|---|------|
| A | `reconcileLists` 純粋関数が未設計。`src/features/sync/services/reconcile.ts` への追加が§4-1 ファイル表にも§4-7 にもない。Phase 9/10.1b には対応する純粋関数があるため非対称 |
| B | `pendingListIds` の単一 Set は upsert/delete 区別不可（T6 詳細）|
| C | `useInitialMerge` の lists 結果反映後に items/sets が両方失敗した場合の挙動が暗黙。`setHasMerged(true)` 未実行が正しいが、lists ストアは既に更新済みである旨の明示が必要 |

## 横断課題（`技術負債と将来課題.md` への登録候補）

| 候補 | 内容 | 理由 |
|------|------|------|
| **MAINT-3** | API route の Service 層方針統一（items/sets も lists と同様の Service 層へ移行する/しないの判断）| 10.2 で lists のみ Service 層導入 → items/sets との非対称が長期保守コストを増やす（T15）|
| **MAINT-4** | `reconcile*.ts` の純粋関数をジェネリック化（`reconcile<T extends { id: string; updatedAt: string }>()`）| Phase 9/10.1b/10.2 と横展開のたび同構造コードが 3 本に |

## サマリー

- 高優先度: **6 件**（うち 4 件は安全性・整合性に直結 = T2/T3/T6/T9）
- 中優先度: 6 件
- 低優先度: 3 件
- 既存パターンとの非対称: 3 件
- 横断課題候補: 2 件（MAINT-3 / MAINT-4）

実装着手前に少なくとも T1〜T6 を反映した v1.5 を起こすことを推奨。
