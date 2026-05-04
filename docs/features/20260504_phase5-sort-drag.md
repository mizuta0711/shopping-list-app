# 機能設計書: 買い物リスト Phase 5 — ソート切替 + ドラッグ並べ替え

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🟢 完了 |
| 変更の性質 | 新規追加 |
| 変更規模 | M |
| Stage 1（機能・画面設計）| ✅ 確定（事前承認） |
| Stage 2（技術設計） | ✅ 確定（事前承認） |
| 作成日 | 2026-05-04 |
| 最終更新 | 2026-05-04 |

---

## 1. 概要

### 背景

[企画書 v0.3](../企画書.md) Phase 5。F-07（ソート切替）と F-11（ドラッグ並び替え）を実装する。
Phase 1.5 でデータモデル（`order` フィールド、`MANUAL` ソートキー、`reorderItems` アクション）は実装済み。本 Phase は **UI のみ**。

### 目的

- ヘッダーに **ソート切替メニュー** を設置し、ユーザーが「名前順 / 登録日時順 / 手動順」を選べるようにする
- 未購入リストを **長押しドラッグで並べ替え** できるようにする
- ドラッグした瞬間に自動でソートを `MANUAL` に切り替える（企画書 §10.8 で確定）

### 方針

| 観点 | 判断 |
|------|------|
| ライブラリ | `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`（モバイル対応・React 19 互換） |
| ドラッグ起動 | 長押し（`PointerSensor` の `activationConstraint: { delay: 250, tolerance: 5 }`）。タップは購入チェックや scope 移動として動く |
| 並び替えのスコープ | 現在アクティブなタブの未購入アイテムのみ対象。タブを跨いだドラッグは不可 |
| ソート自動切替 | ドラッグ完了時に `setSort('MANUAL')` を呼んだ後 `reorderItems(scope, ids)` を実行 |
| ソート UI | ヘッダー右に小さなアイコンボタン。タップでポップオーバーが開き、3つのラジオ的選択肢を表示。アクティブなものはチェックマーク |
| ポップオーバーの閉じ方 | バックドロップタップ or 選択時に自動で閉じる |
| 視覚フィードバック | ドラッグ中: `opacity-50` + `shadow-lg` で浮き上がり。並び替え中の DOM 移動は dnd-kit の transform で自動 |

---

## 2. タスク一覧

| # | フェーズ | タスク | ステータス | 備考 |
|---|---------|--------|-----------|------|
| 1 | Phase 5 | dnd-kit 3パッケージ追加 | ✅ 完了 | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| 2 | Phase 5 | `SortMenu` コンポーネント新規 | ✅ 完了 | ヘッダー右、バックドロップ閉じ対応 |
| 3 | Phase 5 | `SortableItemRow` コンポーネント新規 | ✅ 完了 | useSortable + opacity/shadow 視覚効果 |
| 4 | Phase 5 | `ShoppingMainView` を DndContext で包む | ✅ 完了 | PointerSensor 250ms delay |
| 5 | Phase 5 | `ShoppingMainView` のヘッダーに `SortMenu` を配置 | ✅ 完了 | |
| 6 | Phase 5 | ビルド・型チェック・lint 確認 | ✅ 完了 | 全クリーン |
| 7 | Phase 5 | ブラウザ動作確認 | ✅ 完了 | 5件追加→名前ソートで五十音順→手動選択→PointerEvent 模擬で A を末尾にドラッグ→`B,C,D,A` 順に並び替わり、sort が `MANUAL` に自動切替されることを確認 |

---

## 4. 技術設計（Stage 2）

### 4-1. 作成・変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/features/shopping/components/SortMenu.tsx` | 新規 | ソート切替ポップオーバー |
| `src/features/shopping/components/SortableItemRow.tsx` | 新規 | useSortable で行をドラッグ対応 |
| `src/features/shopping/components/ShoppingMainView.tsx` | 変更 | DndContext + SortableContext を導入、SortMenu を配置 |
| `package.json` | 変更 | dnd-kit 3パッケージ追加 |

### 4-2. SortMenu

```typescript
type Props = {
  active: SortKey;
  onChange: (sort: SortKey) => void;
};
```

```tsx
const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'CREATED_AT', label: '登録日時' },
  { key: 'NAME', label: '名前' },
  { key: 'MANUAL', label: '手動' },
];
```

開閉トグルは `useState(false)`、外側クリック検知は固定背景の `<button>` 要素で実装。

### 4-3. SortableItemRow

```tsx
"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableItemRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ShoppingItemRow {...props} />
    </div>
  );
}
```

長押し起動なので `listeners` は行全体に付与する。短いタップは購入チェック/scope 移動の onClick が動作する。

### 4-4. ShoppingMainView 改修

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
);
const setSort = useShoppingStore((s) => s.setSort);
const reorderItems = useShoppingStore((s) => s.reorderItems);

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = visibleItems.findIndex((i) => i.id === active.id);
  const newIndex = visibleItems.findIndex((i) => i.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;
  const newOrder = arrayMove(visibleItems, oldIndex, newIndex).map((i) => i.id);
  if (sort !== 'MANUAL') setSort('MANUAL');
  reorderItems(activeScope, newOrder);
};

return (
  <main>
    <header>... <SortMenu active={sort} onChange={setSort} /> </header>
    <ScopeTabs ... />
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={visibleItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <ul>
          {visibleItems.map(item => <SortableItemRow key={item.id} item={item} ... />)}
        </ul>
      </SortableContext>
    </DndContext>
    ...
  </main>
);
```

---

## 5. ブラウザ評価計画

### 5-3. 機能テスト項目

| # | 操作手順 | 期待結果 |
|---|---------|---------|
| 1 | 5件追加 → ソートメニューを「名前」に変更 | アイテムが五十音順に並び替わる |
| 2 | ソートメニューを「登録日時」に戻す | 元の追加順に戻る |
| 3 | アイテムを長押しドラッグして別位置にドロップ | 並び替わり、ソートが「手動」に自動切替 |
| 4 | ソートメニューが「手動」のまま、別アイテムをドラッグ | さらに並び替わる |
| 5 | ソートを「名前」に戻す | 五十音順に再並び替え（手動順序は保持されるが表示順は名前優先） |
| 6 | 別タブ（また今度）で並び替え | 「今日」タブの並び順は影響を受けない |

### 5-4. UX 評価の重点観点

| 観点 | 確認ポイント |
|------|-------------|
| ドラッグ起動 | 短いタップでは購入チェックが動作する。長押しのみドラッグ起動 |
| 視覚フィードバック | ドラッグ中の opacity 変化が分かる |
| メニュー UX | ソートメニューがバックドロップタップで閉じる |

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成 | Claude Code |
