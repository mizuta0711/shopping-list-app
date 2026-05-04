# 機能設計書: 買い物リスト 状態管理ストア基盤

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🟢 完了 |
| 変更の性質 | 新規追加 |
| 変更規模 | M |
| Stage 1（機能・画面設計）| ⚪ 不要 |
| Stage 2（技術設計） | ✅ 確定 |
| 作成日 | 2026-05-04 |
| 最終更新 | 2026-05-04 |

---

## 1. 概要

### 背景

[企画書](../企画書.md) Phase 1 として、買い物リストアプリの **状態管理ストア基盤** を整備する。
MVP は LocalStorage 管理のため、UI より先に永続化対応のストア・型定義を確立し、以降の Phase で UI から呼び出す土台にする。

### 目的

- 買い物リストアプリの**全状態を1つの Zustand ストアで集約管理**する
- 状態を **LocalStorage に自動永続化**する（`zustand/middleware` の `persist`）
- 将来クラウド同期を見越した**型・データ構造**を確立する（`id` グローバル一意 / `updatedAt` 必須）
- UI が消費する **基本セレクタ**（タブ別フィルタ、ソート）を提供する

### 方針

| 観点 | 判断 |
|------|------|
| ID 生成 | `crypto.randomUUID()` を使用（標準API、追加依存なし、UUID v4 でグローバル一意） |
| 永続化 | `zustand/middleware` の `persist` + `createJSONStorage(() => localStorage)` |
| バージョニング | ストアに `version` を持たせ、将来データ構造変更時にマイグレーション可能にする |
| SSR 対応 | ストア自体は素のJS。`localStorage` 参照は `persist` ミドルウェア内のみ → 利用側コンポーネントのみ `'use client'` を付ける |
| ファイル配置 | CLAUDE.md の Feature 構成に従い `src/features/shopping/` 配下に配置 |
| セレクタ | 純粋関数として `selectors.ts` に分離（テスト容易性 + コンポーネント側の useMemo 化が容易） |

---

## 2. タスク一覧

| # | フェーズ | タスク | ステータス | 備考 |
|---|---------|--------|-----------|------|
| 1 | Stage 2 | 設計書記入 | ✅ 完了 | |
| 2 | Phase 1 | 型定義（`src/features/shopping/types.ts`） | ✅ 完了 | |
| 3 | Phase 1 | ストア実装（`src/features/shopping/stores/shoppingStore.ts`） | ✅ 完了 | |
| 4 | Phase 1 | セレクタ実装（`src/features/shopping/stores/selectors.ts`） | ✅ 完了 | |
| 5 | Phase 1 | ビルド・型チェック・lint 確認 | ✅ 完了 | 全クリーン |
| 6 | Phase 1 | 設計書更新（状態管理ガイド） | ✅ 完了 | `02_state_management_guide.md` を本実装の内容に書き換え |

---

## 3. 機能・画面設計（Stage 1）

⚪ **不要**: M 規模・UX 変更なし（純粋な状態管理基盤の追加で UI 変更を伴わないため）。

---

## 4. 技術設計（Stage 2）

### 4-1. 作成・変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/features/shopping/types.ts` | 新規 | `ShoppingItem`, `ItemScope`, `ItemStatus`, `SortKey`, `STORAGE_KEY`, `STORAGE_VERSION` を定義 |
| `src/features/shopping/stores/shoppingStore.ts` | 新規 | Zustand ストア本体。state + actions + persist 設定 |
| `src/features/shopping/stores/selectors.ts` | 新規 | 純粋関数のセレクタ群（フィルタ・ソート） |

### 4-2. API 仕様

ストア・セレクタの公開シグネチャを「クライアント内 API」として明記する。

#### 型定義

```typescript
export type ItemScope = 'TODAY' | 'LATER';
export type ItemStatus = 'PENDING' | 'PURCHASED';
export type SortKey = 'NAME' | 'CREATED_AT';

export type ShoppingItem = {
  id: string;            // crypto.randomUUID()
  name: string;          // 商品名（trim 済み・空文字不可）
  scope: ItemScope;
  status: ItemStatus;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601（同期用）
  purchasedAt: string | null;
};

export const STORAGE_KEY = 'shopping-list-app:state';
export const STORAGE_VERSION = 1;
```

#### ストアの State

```typescript
type ShoppingState = {
  items: ShoppingItem[];
  sort: SortKey;
  hasOnboarded: boolean;
};
```

#### ストアの Actions

| Action | シグネチャ | 振る舞い |
|--------|-----------|---------|
| `addItem` | `(name: string, scope?: ItemScope) => void` | trim 後、空文字なら no-op。デフォルト scope は `'TODAY'` |
| `addItems` | `(names: string[], scope?: ItemScope) => void` | 各要素を trim、空文字を除外。一括追加（同一 createdAt） |
| `togglePurchased` | `(id: string) => void` | `PENDING ⇄ PURCHASED` 切替。`PURCHASED` 化で `purchasedAt` 設定、戻すと `null` |
| `moveScope` | `(id: string, scope: ItemScope) => void` | `TODAY ⇔ LATER` 切替 |
| `deleteItem` | `(id: string) => void` | アイテムを配列から削除 |
| `setSort` | `(sort: SortKey) => void` | ソートキー変更 |
| `setHasOnboarded` | `(value: boolean) => void` | オンボーディング表示済みフラグ更新 |
| `reset` | `() => void` | 全状態を初期値に戻す（設定画面の「全削除」用） |

すべての変更系 Action は `updatedAt` を更新する（`setSort` / `setHasOnboarded` を除く）。

#### セレクタ

```typescript
export const filterPendingByScope = (
  items: ShoppingItem[],
  scope: ItemScope
): ShoppingItem[] => items.filter((i) => i.status === 'PENDING' && i.scope === scope);

export const filterPurchased = (items: ShoppingItem[]): ShoppingItem[] =>
  items.filter((i) => i.status === 'PURCHASED');

export const sortItems = (items: ShoppingItem[], sort: SortKey): ShoppingItem[] => {
  const arr = [...items];
  if (sort === 'NAME') {
    return arr.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
  return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};
```

### 4-3. テーブル構造 / スキーマ変更

DB 変更なし（MVP は LocalStorage のみ）。

### 4-4. サービス・フック設計

サービス層・フックは Phase 1 では追加しない（直接ストアを `useShoppingStore` で参照する）。
将来クラウド同期 Phase で `services/syncService.ts` などを追加する想定。

### 4-5. persist 設定詳細

```typescript
persist(stateCreator, {
  name: STORAGE_KEY,
  version: STORAGE_VERSION,
  storage: createJSONStorage(() => localStorage),
  partialize: (s) => ({
    items: s.items,
    sort: s.sort,
    hasOnboarded: s.hasOnboarded,
  }),
})
```

- `partialize`: 永続化対象を明示的に絞る（将来 derived state を State に持たせた場合に保存しないため）
- `version`: 将来構造変更時は `migrate` オプションで対応（現時点では未指定）
- 容量制限・JSON パース失敗時のフォールバック: Phase 1 では未対応。企画書 §10.7 として将来対応

---

## 5. ブラウザ評価計画

⚪ **不要**: UI 変更なし（純粋な状態管理層のみの追加）。
ストアの動作確認は次 Phase（メイン画面実装）の `/browser-test` で間接的に検証される。
本 Phase では型チェック・ビルド成功 + コードレビューで完了とする。

---

## 6. 関連ドキュメント

| ドキュメント | 関連内容 |
|-------------|---------|
| [企画書](../企画書.md) | §7 データモデル、§9 Phase 1、§10.7 将来課題 |
| [.claude/03_library_docs/02_state_management_guide.md](../../.claude/03_library_docs/02_state_management_guide.md) | Zustand 利用ガイド |

---

## 7. 注意事項

- **SSR で localStorage を直接参照しない**。`persist` 経由は内部でガードされているが、コンポーネントから直接 `localStorage.getItem` を呼ばない
- **ストアを利用するコンポーネントは `'use client'` 必須**。Phase 2 以降の UI 実装時に意識する
- **`updatedAt` の更新漏れ注意**。データ変更系 Action では必ず更新する（将来の同期で衝突解決に使用）
- **空文字バリデーション**は `addItem` / `addItems` の中で完結させる（UI 側で重複チェックしないで済むように）

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成 | Claude Code |
