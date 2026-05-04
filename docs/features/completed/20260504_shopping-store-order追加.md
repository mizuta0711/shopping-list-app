# 機能設計書: 買い物リスト Phase 1.5 — order フィールド + MANUAL ソート

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🟢 完了 |
| 変更の性質 | 改修 |
| 変更規模 | M |
| Stage 1（機能・画面設計）| ⚪ 不要 |
| Stage 2（技術設計） | ✅ 確定 |
| 作成日 | 2026-05-04 |
| 最終更新 | 2026-05-04 |

---

## 1. 概要

### 背景

[企画書 v0.3](../企画書.md) で F-11「ドラッグでの並び替え」を MVP 要件に追加した。
Phase 5 でドラッグ UI を実装するに先立ち、**Phase 1 で構築したストアにデータモデルとアクションを追加** する。

### 目的

- `ShoppingItem` に **`order: number`** フィールドを追加し、手動並び替えの順序を保持する
- `SortKey` に **`'MANUAL'`** を追加し、手動順ソートを選択可能にする
- `reorderItems` アクションを追加し、UI からの並び替え操作を受け付ける
- 既存データ（version 1 の persist）に対して **マイグレーション** を提供する

### 方針

| 観点 | 判断 |
|------|------|
| `order` の採番方針 | アイテム追加時、同一 scope 内の最大 order + 1 を割り当てる（末尾追加） |
| `moveScope` 時 | scope を跨いで移動する場合、移動先の scope の最大 order + 1 を割り当て直す |
| `MANUAL` ソート時の振る舞い | `order` 昇順に並べる |
| ドラッグ時のソート切替 | UI からは `setSort('MANUAL')` を別途呼ぶ。ストアレベルでは reorder と sort 切替は分離する（責務分離） |
| マイグレーション | persist の `migrate` を使い、v1 → v2 で `order` を `createdAt` 順に 0,1,2... を割り当てる（scope ごとに連番） |
| ストレージバージョン | `STORAGE_VERSION` を 1 → 2 に更新 |

---

## 2. タスク一覧

| # | フェーズ | タスク | ステータス | 備考 |
|---|---------|--------|-----------|------|
| 1 | Stage 2 | 設計書記入 | ✅ 完了 | |
| 2 | Phase 1.5 | 型定義に `order` / `MANUAL` 追加 | ✅ 完了 | `src/features/shopping/types.ts` |
| 3 | Phase 1.5 | ストアの `addItem` / `addItems` / `moveScope` を改修 | ✅ 完了 | order 自動採番 |
| 4 | Phase 1.5 | `reorderItems` アクション追加 | ✅ 完了 | |
| 5 | Phase 1.5 | `sortItems` セレクタを `MANUAL` 対応に拡張 | ✅ 完了 | |
| 6 | Phase 1.5 | persist の `migrate` で v1 → v2 移行を実装 | ✅ 完了 | 既存データ保護 |
| 7 | Phase 1.5 | ビルド・型チェック・lint 確認 | ✅ 完了 | 全クリーン |
| 8 | Phase 1.5 | `02_state_management_guide.md` 更新 | ✅ 完了 | reorderItems / MANUAL を追記 |

---

## 3. 機能・画面設計（Stage 1）

⚪ **不要**: M 規模、UX 変更なし（純粋なデータ層拡張）。ドラッグ UI は Phase 5。

---

## 4. 技術設計（Stage 2）

### 4-1. 作成・変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/features/shopping/types.ts` | 変更 | `ShoppingItem` に `order: number` 追加、`SortKey` に `'MANUAL'` 追加、`STORAGE_VERSION` を 2 へ |
| `src/features/shopping/stores/shoppingStore.ts` | 変更 | `buildItem` で order 採番、`moveScope` で再採番、`reorderItems` 追加、`migrate` 関数追加 |
| `src/features/shopping/stores/selectors.ts` | 変更 | `sortItems` で `MANUAL` を扱う |
| `.claude/03_library_docs/02_state_management_guide.md` | 変更 | 新アクションを反映 |

### 4-2. 型定義の変更

```typescript
export type SortKey = 'NAME' | 'CREATED_AT' | 'MANUAL';

export type ShoppingItem = {
  id: string;
  name: string;
  scope: ItemScope;
  status: ItemStatus;
  order: number;            // 追加: 手動並び替えの順序（同一 scope 内で昇順）
  createdAt: string;
  updatedAt: string;
  purchasedAt: string | null;
};

export const STORAGE_VERSION = 2;  // 1 → 2 へ
```

### 4-3. ストア改修

#### 新規アクション

```typescript
reorderItems: (scope: ItemScope, orderedIds: string[]) => void;
```

- 指定された scope の **PENDING** アイテムについて、`orderedIds` の並びで `order` を 0,1,2,... と振り直す
- PURCHASED アイテムは触らない（=並び替えはあくまで「未購入リスト」の中の順序）
- すべての対象アイテムの `updatedAt` を現時刻で更新

#### `addItem` / `addItems` の改修

```typescript
const nextOrder = (items: ShoppingItem[], scope: ItemScope): number => {
  const max = items
    .filter((i) => i.scope === scope)
    .reduce((acc, i) => Math.max(acc, i.order), -1);
  return max + 1;
};
```

- 追加時に `nextOrder(state.items, scope)` で末尾に追加

#### `moveScope` の改修

- 移動先 scope の最大 order + 1 を割り当て直す（移動先で末尾に置かれる）

### 4-4. セレクタの拡張

```typescript
export const sortItems = (items: ShoppingItem[], sort: SortKey): ShoppingItem[] => {
  const arr = [...items];
  if (sort === 'NAME') return arr.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  if (sort === 'MANUAL') return arr.sort((a, b) => a.order - b.order);
  return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};
```

### 4-5. persist マイグレーション

```typescript
persist(stateCreator, {
  name: STORAGE_KEY,
  version: STORAGE_VERSION,        // 2
  storage: createJSONStorage(() => localStorage),
  migrate: (persistedState, version) => {
    if (version < 2 && persistedState) {
      const state = persistedState as { items?: Array<Partial<ShoppingItem>> };
      const items = (state.items ?? []) as ShoppingItem[];

      // scope ごとに createdAt 昇順で 0,1,2,... を割り振る
      const byScope: Record<ItemScope, ShoppingItem[]> = { TODAY: [], LATER: [] };
      for (const item of items) byScope[item.scope].push(item);

      const migrated: ShoppingItem[] = [];
      (Object.keys(byScope) as ItemScope[]).forEach((scope) => {
        byScope[scope]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .forEach((item, idx) => migrated.push({ ...item, order: idx }));
      });

      return { ...state, items: migrated };
    }
    return persistedState;
  },
  partialize: (s) => ({ items: s.items, sort: s.sort, hasOnboarded: s.hasOnboarded }),
});
```

### 4-6. テーブル構造 / スキーマ変更

DB 変更なし。

---

## 5. ブラウザ評価計画

⚪ **不要**: UI 変更なし。型チェック・ビルド成功 + コードレビュー（自己レビュー）で完了とする。

---

## 6. 関連ドキュメント

| ドキュメント | 関連内容 |
|-------------|---------|
| [企画書 v0.3](../企画書.md) | §7 データモデル（`order` 追加）、§10.8 ドラッグ UX 方針 |
| [Phase 1 設計書](./20260504_shopping-store基盤.md) | 拡張元 |
| [.claude/03_library_docs/02_state_management_guide.md](../../.claude/03_library_docs/02_state_management_guide.md) | 反映先 |

---

## 7. 注意事項

- マイグレーションは **冪等** にすること（複数回呼ばれても結果が変わらない）
- `reorderItems` の引数 `orderedIds` には対象 scope の全 PENDING アイテムが含まれる前提（UI 側で担保）。欠落時は無視する
- ストレージバージョン更新によりデフォルト値で起動するケースを想定し、`migrate` 関数は防御的に書く

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成 | Claude Code |
