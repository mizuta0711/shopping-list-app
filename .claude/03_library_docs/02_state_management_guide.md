# 状態管理ガイド

## Zustand 5 ストア設計

### 設計原則

1. **機能別分離** — 各機能ドメインに独立ストアを作成（`src/features/{feature}/stores/`）
2. **LocalStorage 永続化** — `persist` ミドルウェア使用
3. **不変性維持** — 配列は常に新しい参照を作成（スプレッド・map/filter）
4. **型安全性** — `any` 型完全禁止
5. **`updatedAt` 必須** — 将来クラウド同期に備え、データ変更系 Action は必ず `updatedAt` を更新する

### ストア一覧

| ストア | ファイルパス | persist キー | 主要状態 | 主要アクション |
|---|---|---|---|---|
| `useShoppingStore` | `src/features/shopping/stores/shoppingStore.ts` | `shopping-list-app:state` | items, sort, hasOnboarded | addItem, addItems（同一 scope の PENDING に同名あれば自動スキップ）, togglePurchased, moveScope, reorderItems, deleteItem, setSort, setHasOnboarded, reset |

セレクタは `src/features/{feature}/stores/selectors.ts` に純粋関数として分離する（テスト容易性 + UI 側で `useMemo` 化が容易）。

### ストア実装パターン

```typescript
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type State = {
  items: Item[];
};

type Actions = {
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
};

const initialState: State = { items: [] };

export const useExampleStore = create<State & Actions>()(
  persist(
    (set) => ({
      ...initialState,
      addItem: (item) =>
        set((state) => ({ items: [...state.items, item] })),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
    }),
    {
      name: 'example-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
```

### ストア設計方針（永続化 vs ローカルステート）

#### ストアに入れるもの（Zustand）

| 種類 | 例 | 理由 |
|------|-----|------|
| 永続化が必要なエンティティ | 買い物リストアイテム | LocalStorage 保存で再訪問時に復元 |
| ユーザー設定 | ソート順、オンボーディング表示済みフラグ | 端末ローカルで保持 |
| 複数コンポーネントから参照される状態 | アクティブタブ（現状は URL/Path で管理予定） | 単一ソース化 |

#### ストアに入れないもの（`useState`）

| 種類 | 例 | 理由 |
|------|-----|------|
| UIの一時的な状態 | モーダルの開閉、フォーム入力値 | コンポーネントのライフサイクルに紐づく |
| 派生データ | フィルタ・ソート後の配列 | セレクタ関数で都度計算（`useMemo` 推奨） |

### ID 生成

`crypto.randomUUID()` を使用する。標準API、追加依存なし、UUID v4 でグローバル一意。
将来クラウド同期した場合もサーバー側との衝突なし。

### `partialize` で永続化対象を絞る

派生 state や UIステートをストアに含める場合に備え、`partialize` で永続化対象を明示する。

```typescript
partialize: (state) => ({
  items: state.items,
  sort: state.sort,
}),
```

## パフォーマンス考慮

### ストアセレクター

不要な再レンダリングを防止するため、必要な値のみ選択する。

```typescript
// 推奨: 必要な値だけ取得
const items = useShoppingStore((state) => state.items);
const sort = useShoppingStore((state) => state.sort);

// 非推奨: ストア全体取得
const store = useShoppingStore();
```

派生データはコンポーネント側で `useMemo` + 純粋セレクタ関数で計算する。

```typescript
import { filterPendingByScope, sortItems } from '@/features/shopping/stores/selectors';

const items = useShoppingStore((s) => s.items);
const sort = useShoppingStore((s) => s.sort);

const todayItems = useMemo(
  () => sortItems(filterPendingByScope(items, 'TODAY'), sort),
  [items, sort],
);
```

### ハイドレーション問題

SSR/CSR の不一致に注意。`localStorage` から復元される値は、サーバーサイドレンダリング時に存在しない。

対策:
- ストアを使うコンポーネントは `'use client'` を付与
- 初回マウント前後でレイアウトが変わる場合は `useEffect` で hydration 完了を待つ、もしくはスケルトン表示

## 改訂履歴

| 版数 | 日付 | 内容 | 担当 |
|------|------|------|------|
| 1.0 | 2026-04-02 | 初版作成（テンプレート適用） | Claude Code |
| 1.1 | 2026-04-02 | ストア設計方針セクション追加 | Claude Code |
| 1.2 | 2026-04-02 | テンプレート整合性修正 | Claude Code |
| 2.0 | 2026-05-04 | shopping-list-app 実装に合わせて全面書き換え（`useShoppingStore` ストア追加、API キャッシュ前提の文言を削除、ID生成方針を追記） | Claude Code |
| 2.1 | 2026-05-04 | Phase 1.5: `reorderItems` 追加、`SortKey` に `MANUAL` 追加、`order` フィールド・migrate 関数を反映 | Claude Code |
