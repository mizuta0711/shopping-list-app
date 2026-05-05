# 機能設計書: 買い物リスト Phase 13 — 編集モードによる編集・削除・並び替え UI

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🟢 完了 |
| 変更の性質 | 改修（Phase 11 のスワイプ UX を巻き戻し、編集モード切替型に置換） |
| 変更規模 | M（UX 変更を含むが既存実装の置換のため軽量フローで対応） |
| Stage 1（機能・画面設計）| ⚪ 不要（対話で確定） |
| Stage 2（技術設計） | 🟡 本書 |
| 作成日 | 2026-05-05 |
| 最終更新 | 2026-05-05 |

---

## 1. 概要

### 背景

Phase 11 で導入したスワイプ操作による行アクション UI は、実機での操作感が悪く、一部動作不安定な挙動が見られた（横方向のジェスチャ判定の不安定性、`@use-gesture/react` の dnd-kit との競合）。利用者からの直接フィードバックを受けて、より明示的な「編集モード切替」型の UI に置換する。

### 目的

- スワイプ依存の暗黙的 UX を撤廃し、トグル型の **編集モード** に置き換えて操作の可視性を高める
- 編集・削除・並び替えなど低頻度操作を編集モード ON 時のみ露出し、通常モードは「チェック切替 + また今度移動」の最小操作に絞る
- 横スクロール・ジェスチャ競合の根本解消

### 方針（対話で合意）

| 観点 | 判断 |
|---|---|
| スワイプ機能 | **完全撤廃**。`SwipeableRow` および `@use-gesture/react` を削除 |
| 編集モード切替 | メイン画面ヘッダー右に **鉛筆アイコン**ボタンを追加。タップで ON/OFF。ON 時はボタンを `bg-gray-900 + text-white` でハイライト |
| 非編集モード | 行: チェック切替（タップ）+ また今度移動（→ボタン）のみ。ドラッグハンドル・編集・削除アイコンは非表示 |
| 編集モード | PENDING 行末に **編集（鉛筆）+ 削除（赤ゴミ箱）+ ハンドル ≡** を表示。また今度移動ボタンは隠す |
| ドラッグ | `useSortable.disabled = !editMode` で編集モード時のみ並び替え有効化。長押し 250ms はそのまま |
| 削除 | `window.confirm` 確認ダイアログ → 削除（Phase 11 のアンドゥ付きトーストは廃止） |
| PURCHASED 行 | 編集モードに関係なく従来表示（編集系ボタン非表示） |
| `restoreItem` ストアアクション | アンドゥトースト廃止に伴い削除 |

---

## 2. タスク一覧

| # | タスク | ステータス | 備考 |
|---|--------|-----------|------|
| 1 | `@use-gesture/react` パッケージ削除 + `SwipeableRow.tsx` 削除 | ✅ 完了 | |
| 2 | `SortableItemRow` を `editMode` プロップ対応に書き換え | ✅ 完了 | useSortable は `disabled: !editMode \|\| isPurchased` |
| 3 | `ShoppingItemRow` に `editMode` プロップを追加し、また今度移動ボタンの表示を分岐 | ✅ 完了 | |
| 4 | `ShoppingMainView` に `editMode` state + ヘッダー右に切替ボタン追加 | ✅ 完了 | |
| 5 | 削除ハンドラを `window.confirm` 方式に変更 | ✅ 完了 | toast.success で完了通知のみ |
| 6 | `shoppingStore.restoreItem` 削除 | ✅ 完了 | アンドゥ廃止に伴う |
| 7 | build / lint / browser-test | ✅ 完了 | 全 23 シナリオ ✅、横スクロール・regression なし |

---

## 3. 技術設計

### 3-1. 変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `package.json` | 変更 | `@use-gesture/react` 依存を削除 |
| `src/features/shopping/components/SwipeableRow.tsx` | 削除 | スワイプ実装を撤廃 |
| `src/features/shopping/components/SortableItemRow.tsx` | 全面書き換え | `editMode` 受け取り、PENDING + editMode 時のみ trailing に編集/削除/ハンドルを描画 |
| `src/features/shopping/components/ShoppingItemRow.tsx` | 変更 | `editMode` プロップ追加。true なら また今度移動ボタンを非表示 |
| `src/features/shopping/components/ShoppingMainView.tsx` | 変更 | `editMode` state、ヘッダー右の Pencil 切替ボタン、削除を `window.confirm` に変更、swipe 関連 state/handler 撤廃 |
| `src/features/shopping/stores/shoppingStore.ts` | 変更 | `restoreItem` アクション削除 |

### 3-2. UX 仕様

```
[非編集モード]
┌────────────────────────────────────────┐
│ 🛒 買い物リスト       🔄  ⇅ ✏️         │ ← ヘッダー（鉛筆=灰色）
├────────────────────────────────────────┤
│ ✓ アイテム名                       →   │ ← また今度移動
└────────────────────────────────────────┘

[編集モード]
┌────────────────────────────────────────┐
│ 🛒 買い物リスト       🔄  ⇅ ▣          │ ← ヘッダー（鉛筆=濃灰背景+白）
├────────────────────────────────────────┤
│ ✓ アイテム名         ✏️  🗑  ≡         │ ← 編集 / 削除 / ハンドル
└────────────────────────────────────────┘
```

### 3-3. 削除確認

```tsx
const handleDeleteRequest = useCallback(
  (item: ShoppingItem) => {
    const confirmed = window.confirm(
      `「${item.name}」を削除します。よろしいですか？`,
    );
    if (!confirmed) return;
    deleteItem(item.id);
    toast.success(`「${item.name}」を削除しました`);
  },
  [deleteItem],
);
```

### 3-4. アクセシビリティ

| 観点 | 対応 |
|------|------|
| 編集モードボタン | `aria-label="編集モードを開始"` / `"編集モードを終了"`、`aria-pressed={editMode}` |
| 編集ボタン | `aria-label="{name} を編集"`、`data-item-id={id}`（モーダル閉じ時にフォーカス復帰） |
| 削除ボタン | `aria-label="{name} を削除"`、赤系配色（破壊的操作の視覚伝達） |
| ハンドル | `aria-label="{name} を並び替え"`、`touch-none` でテキスト選択回避 |
| キーボード | 各ボタン Tab で到達、Enter / Space で発火 |

---

## 4. ブラウザ評価

`tests/browser-evidence/20260505_edit-mode-switch/` に 15 枚のスクリーンショット保存。23 シナリオ ✅、横スクロール 0、regression なし。

ドラッグ並び替え（dnd-kit 250ms 長押し → 縦移動）のみ Playwright MCP では精密制御困難なため実機確認推奨。

---

## 5. 関連ドキュメント

| ドキュメント | 関連内容 |
|-------------|---------|
| [Phase 11 設計書（巻き戻し済み）](./20260505_phase11-swipe-actions.md) | スワイプ UI の元設計。Phase 13 で完全撤廃 |
| [Phase 12 設計書（completed）](./20260505_phase12-bottom-nav.md) | ヘッダー右領域のレイアウト前提 |
| [技術負債と将来課題.md](../../設計書/技術負債と将来課題.md) | UX-2（破壊的操作 UI の統一方針）の状態を更新 |

---

## 6. 注意事項

- Phase 11 のスワイプ機能は本フェーズで完全撤廃。`@use-gesture/react` も依存から除去
- 削除 UX はアンドゥ付きトーストから `window.confirm` 方式に戻った。技術負債 UX-2「window.confirm を全廃しインライン確認 / アンドゥトーストへ統一する横断方針」は依然未解消（むしろ後退）
- 編集モードの ON/OFF は **タブ切替やページ遷移で永続化しない**（セッション内のみ。視覚的に明示される鉛筆ボタンで判別可能）

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-05 | (未確定) | 初版（Phase 11 撤廃 + 編集モード切替 UI に置換）。実装 + browser-test 通過済み | Claude Code |
