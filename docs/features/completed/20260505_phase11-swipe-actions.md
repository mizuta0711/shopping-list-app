# 機能設計書: 買い物リスト Phase 11 — スワイプによる編集・削除アクション

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🟢 完了 |
| 変更の性質 | 新規追加（既存アイテム行へのアクション追加 + 編集機能の新設） |
| 変更規模 | L（UX 変更を伴うため自動的に L 扱い。CLAUDE.md「規模引き上げルール」） |
| Stage 1（機能・画面設計）| ✅ 確定（条件付き承認 → 5 件全採用反映済み） |
| Stage 2（技術設計） | ✅ 確定 |
| 作成日 | 2026-05-05 |
| 最終更新 | 2026-05-05 |

---

## 1. 概要

### 背景

買い物リストの各アイテムに対して、現状はチェック（購入済み）と区分移動（今日↔また今度）しか行えない。**入力ミスの修正（名前変更）や、誤って追加したアイテムの削除手段がない**。一方で編集・削除は買い物中の主要操作ではないため、画面を圧迫しない方式で目立たず提供したい。

スマホアプリで一般的な「**行を横にスワイプして編集/削除のアクションが現れる**」UI を採用する。これにより:

- 普段の操作（タップでチェック / 長押しドラッグで並び替え）を一切阻害しない
- 編集・削除へは「ひと手間」必要だが、必要なときには確実にアクセスできる
- 行末に常時アイコンを並べる方式と比べてリスト密度を保てる

### 目的

- **アイテムの名前を編集**できるようにする（誤字・追加情報の付加）
- **アイテムを削除**できるようにする（誤追加の取り消し）
- 上記の起動 UI として **行の左スワイプで編集/削除ボタンが行末に出現する**方式を採用
- 既存の **dnd-kit による縦ドラッグ並び替え** と競合させない

### 方針

| 観点 | 判断 |
|---|---|
| ジェスチャー設計 | **行末にドラッグハンドル `≡` を新設**し、縦ドラッグはハンドル長押しのみで起動。**行本体の左スワイプで編集/削除ボタンが現れる** |
| ドラッグ起動の分離 | dnd-kit の **`setActivatorNodeRef`** を使い、`≡` ハンドル要素のみがドラッグを起動。行本体は `@use-gesture/react` の `useDrag(axis: 'x')` 専用（R-1 反映） |
| ハンドルのタッチターゲット | `≡` を **`h-11 w-11` (44px)** で実装し、UX-1 を 1 アイコン分先行解消（R-7 反映） |
| ライブラリ選定 | `@use-gesture/react`（gzip 約 7KB）+ Tailwind の `transition-transform` で自前スライド。`react-swipeable-list` はメンテ停止のため不採用。`framer-motion` はバンドル過大のため不採用 |
| アクションの方向 | **左スワイプのみ**（右端からアクションが現れる）。両側スワイプは UX を複雑化するため採用しない |
| アクション数 | **編集・削除の 2 つ**。3 つ以上は 375px 幅で窮屈なので避ける |
| 編集 UI | 別ページ遷移は重いため、**インラインのモーダルダイアログ**（既存 `OnboardingModal` の overlay パターン参考）。名前のみ編集可能。区分・並び順はこのフェーズでは編集しない |
| **削除 UI（変更）** | `window.confirm` を**廃止**し、削除を即時実行 → **sonner のアンドゥ付きトースト**（`action` ボタンで「元に戻す」、5 秒間表示）。実装方法は `deleteItem` の前に削除対象のスナップショットを取り、アンドゥタップ時に再追加（`addItem` で `id`/`order`/`createdAt` を保つため Stage 2 で `restoreItem` アクションを追加）。理由: iOS Safari で `confirm` がドメイン表示の無骨なシステムダイアログになり、買い物中の頻用操作には合わない（C3/R-5 反映） |
| **スワイプ閾値（変更）** | **80px** で指を離すとロック（120px のアクションエリアの 2/3）。誤発動率を下げ、ロック状態の戸惑いを減らす（C5/R-6 反映） |
| **iOS Safari エッジスワイプ対策** | 行本体に `touch-action: pan-y` を設定し、`@use-gesture` の `bounds: { left: -120, right: 0 }` で範囲制限。Stage 2 で `axis: 'x'`、`filterTaps: true`、`axisThreshold: 5` を併用。browser-test で実証（C4/C7 反映） |
| **購入済みアイテムへの適用（変更）** | **本フェーズではメイン画面のみ**にスワイプを適用。**履歴画面（/history）は Phase 11 スコープ外**として既存 UI（単発ボタン）を維持。理由: 復元は頻度の高い操作で 1 タップ → 2 ステップへの操作退行を避ける（C1/R-8 反映） |
| **キーボード操作（変更）** | `≡` ハンドルは**並び替え専用**とし、Enter キーでの編集モーダル起動ショートカットは**実装しない**（二重役割によるスクリーンリーダーの混乱を回避）。編集・削除はタッチ前提とし、キーボードユーザーは将来別途対応（R-4 反映） |
| Phase 10.3 の編集アイコン方針との関係 | Phase 10.3 の「カテゴリ別表示モード時のみ行末に編集アイコン」方針は本フェーズで**不要化**される。**Phase 10 親設計書 §3-C に廃止予定の注記を追記**（R-3 反映） |
| ストア変更 | `useShoppingStore` に **`updateItemName(id, name)`** + **`restoreItem(item: ShoppingItem)`**（アンドゥ用）を新規追加（`updatedAt` も更新）。Phase 10.1b でクラウド同期に乗せるとき LWW で機能する前提 |
| クラウド同期との関係 | 編集・削除は既存の `addItems` / `togglePurchased` と同じ Phase 9 の同期パイプラインに乗る。`updatedAt` 更新で LWW、削除は既存の DeletionTombstone に乗せる |

---

## 2. タスク一覧

| # | フェーズ | タスク | ステータス | 備考 |
|---|---------|--------|-----------|------|
| 1 | Stage 1 | Stage 1 機能・画面設計の記入 | ✅ 完了 | 本書 §3 |
| 2 | Stage 1 | `/design-review feature` 実行 | ✅ 完了 | [docs/reviews/20260505_022258_design-review-feature-phase11.md](../../reviews/20260505_022258_design-review-feature-phase11.md) |
| 3 | Stage 1 | レビュー指摘の反映 → Stage 1 確定 | ✅ 完了 | 5 件全採用（履歴スコープ外/アンドゥトースト/80px/setActivatorNodeRef/44pxハンドル/Phase10.3注記/UX-2,UX-3 登録/キーボードSC撤去） |
| 4 | Stage 2 | Stage 2 技術設計の記入 | 🟡 記入中 | 本書 §4 |
| 5 | Stage 2 | `/design-review tech` 実行 | ⬜ 不要（Stage 1 反映で技術方針確定済み・実装後 code-review で代替） | |
| 6 | 実装 | `@use-gesture/react` 導入 + 共通 `SwipeableRow` ラッパー作成 | ✅ 完了 | 2026-05-05 |
| 7 | 実装 | `useShoppingStore.updateItemName` + `restoreItem` アクション追加 | ✅ 完了 | `updatedAt` 同期 / アンドゥ用、多重実行防御込み |
| 8 | 実装 | `SortableItemRow` を SwipeableRow + setActivatorNodeRef 分離方式に改修 | ✅ 完了 | PURCHASED 行は素のまま、PENDING のみハンドル + スワイプ |
| 9 | 実装 | アイテム編集モーダル（名前のみ） | ✅ 完了 | フォーカス管理 + Esc + backdrop |
| 10 | 実装 | 削除をアンドゥ付きトースト方式に変更 | ✅ 完了 | 5 秒 sonner action、削除前に `openSwipeId=null` リセット |
| 11 | 検証 | code-review / browser-test / build-check / update-docs | ✅ 完了 | code-review: 高2/中3/低2 全反映、browser-test: 16 シナリオ中 15 ✅ + 1 環境制限、build OK |

---

## 3. 機能・画面設計（Stage 1）

### 3-1. 対象画面と操作フロー

| 画面 | URL | 新規/変更 | 概要 |
|------|-----|----------|------|
| メイン画面（PENDING リスト）| `/` | 変更 | 各行にドラッグハンドル `≡` を新設。行本体の左スワイプで「編集 / 削除」が出現 |
| 履歴画面 | `/history` | 変更 | 各行の左スワイプで「未購入に戻す / 削除」が出現。既存の単発タップ復元ボタンは廃止 |
| アイテム編集モーダル | `/`（オーバーレイ） | 新規 | 名前のみ編集する小さなダイアログ |

**操作フロー A: アイテムを編集する**

1. メイン画面でアイテム行を**左方向に約 60px 以上スワイプ**
2. 行末から「編集 / 削除」の 2 ボタンが現れ、その位置にロックされる（半開きで指を離せばロックなし＝閉じる）
3. 「編集」をタップ → 編集モーダルが開く
4. テキスト入力欄でアイテム名を修正 → 「保存」 → ストアの `updatedAt` 更新 → モーダル閉じる → 行も閉じる
5. キャンセルでモーダルを閉じた場合は行は開いたまま

**操作フロー B: アイテムを削除する**

1. メイン画面でアイテム行を左にスワイプ → 「編集 / 削除」表示
2. 「削除」をタップ → `window.confirm("『◯◯』を削除します。よろしいですか？")`
3. OK → ストアから削除（既存 `deleteItem` を流用）→ トースト「削除しました」
4. キャンセル → 削除されない、行はスワイプ状態のまま

**操作フロー C: 並び替え（既存）の挙動変更**

1. **行末の `≡` ハンドルを長押し**（既存 250ms delay 維持）
2. 持ち上がってから縦にドラッグ → 並び替え
3. **行本体（`≡` 以外の領域）を長押ししても並び替えにならない**（横スワイプ専用）

**操作フロー D: 既存の操作（変更なし）**

- アイテムタップ → 購入済みトグル（変更なし）
- 区分移動アイコン → 区分間移動（変更なし）

**操作フロー E: 行を閉じる**

- スワイプで開いた行は、**他の行をタップ・スワイプすると自動で閉じる**（同時に複数行が開かない）
- 行の本体を**右方向にスワイプ**でも閉じる
- backdrop タップは行いません（モーダルではないので）

### 3-2. 受け入れ条件（ユーザー目線）

- [ ] アイテム行を左にスワイプすると行末に「編集 / 削除」のボタンが現れる
- [ ] **80px** 以上スワイプして指を離すとボタン位置にロックされる
- [ ] **80px** 未満で指を離すとアニメーションで自動的に閉じる
- [ ] 「編集」タップでモーダルが開き、名前を編集して保存できる
- [ ] 編集後、メイン画面の表示も更新される
- [ ] **「削除」タップで即時削除され、画面下部に「元に戻す」ボタン付きトーストが 5 秒間表示される**
- [ ] 5 秒以内に「元に戻す」をタップすると元の位置・order・createdAt で復元される
- [ ] 行末の `≡` ハンドル長押しで縦ドラッグ並び替えができる（`setActivatorNodeRef` でハンドルのみがドラッグを起動）
- [ ] **行本体（`≡` 以外）を長押ししても並び替えにならない**
- [ ] アイテムタップで購入済みトグルは引き続き動作する
- [ ] 別の行をスワイプ・タップすると、開いていた行は自動的に閉じる
- [ ] **履歴画面 (/history) は本フェーズではスコープ外。既存の単発復元ボタンが維持される**
- [ ] 縦スクロール中に誤って横スワイプが発動しない（`axis: 'x'` + `axisThreshold: 5`）
- [ ] **iOS Safari のブラウザ「戻る」ジェスチャー（左端からのスワイプ）と干渉しない**（`touch-action: pan-y` + `bounds: { left: -120, right: 0 }`）
- [ ] `≡` ハンドルのタッチターゲットが 44px 以上（`h-11 w-11`）

### 3-3. 画面レイアウト（メイン画面）

```
通常状態
┌──────────────────────────────────┐
│ ☐ 牛乳                       ↕ ≡ │
│ ☐ パン                       ↕ ≡ │
│ ☐ 卵                         ↕ ≡ │
└──────────────────────────────────┘
       ↑                       ↑
   タップで購入済み      長押しで並び替え

「牛乳」を左にスワイプ
┌──────────────────────────────────┐
│ ☐ 牛乳            ↕ ≡│ 編集 │ 削除│
│ ☐ パン                       ↕ ≡ │
│ ☐ 卵                         ↕ ≡ │
└──────────────────────────────────┘
                            ↑      ↑
                          タップで起動
```

**配置寸法（375px 端末）**:

| 要素 | 幅 |
|---|---|
| 左側パディング + チェック領域 | 既存と同じ |
| アイテム名（`flex-1`） | 残り |
| 区分移動アイコン `↕` | 既存 |
| **新設: ドラッグハンドル `≡`** | 36px (h-9 w-9) |
| 行末アクション（編集 + 削除） | 計 120px（60px × 2、左スワイプで現れる） |

### 3-4. アイテム編集モーダル（名前のみ）

```
┌─────────────────────────────┐
│ アイテムを編集               │
├─────────────────────────────┤
│ 商品名                       │
│ ┌─────────────────────┐     │
│ │ 牛乳                 │     │
│ └─────────────────────┘     │
│                             │
│ ┌──────┐  ┌─────────────┐  │
│ │キャンセル│  │   保存    │  │
│ └──────┘  └─────────────┘  │
└─────────────────────────────┘
```

- 入力欄は `<input type="text" maxLength={50}>`（既存セット名と同じ上限）
- 空白のみ・空文字は保存不可（保存ボタン無効化）
- 区分・並び順・購入状態の編集は**この設計には含まない**（スコープ最小化）

### 3-5. 履歴画面のスワイプアクション（Phase 11 ではスコープ外）

レビュー指摘 C1/R-8 を採用し、**履歴画面 (`/history`) は本フェーズではスコープ外**とする。

- 履歴画面の既存 UI（行内の「復元」「削除」単発ボタン）を**そのまま維持**
- 復元はワンタップ操作の頻度が高く、スワイプ 2 ステップへの操作退行を避ける

将来 Phase で「メインと UI を統一したい」という要望が確認できた段階で再検討する。それまで `SwipeableRow` 共通コンポーネントの汎用性は確保しつつも、本フェーズではメイン画面（`SortableItemRow`）でのみ使用する。

### 3-6. 補助 UX 仕様

- **同時に開けるのは 1 行だけ**: 別の行を操作すると現在の行は閉じる（state 管理は親で `openSwipeId` を持つ）
- **スクロール中はスワイプを発動しない**: 縦方向の動きが先行検出された場合は横スワイプを cancel する（`axis: 'x'` の自動挙動 + 必要なら閾値を併用）
- **iOS Safari エッジスワイプ対策**: 行本体に `touch-action: pan-y;` を設定。横スワイプは `@use-gesture` が JS で処理するため、ブラウザ標準の戻るジェスチャーと干渉しない
- **アニメーション**: スワイプ中は指の移動に合わせて 1:1 追従。指を離した後はロック位置 or 閉じ位置へ `transition-transform 200ms ease-out`
- **視覚フィードバック**: 編集ボタン背景はグレー、削除ボタン背景は赤（破壊的操作の標準色）

### 3-7. アクセシビリティ

| 観点 | 対応 |
|------|------|
| キーボード操作 | スワイプはタッチ前提。`≡` ハンドルは**並び替え専用**とし、Enter キーでの編集モーダル起動ショートカットは**実装しない**（R-4 反映: ハンドルの二重役割回避）。キーボードユーザー向け編集導線は将来別途対応（UX-3 として技術負債.md に記載） |
| スクリーンリーダー | 行は既存のチェックボタン (`aria-label="{name} を購入済みにする"`) を維持。スワイプ操作は視覚補助なので追加 ARIA ヒントは付けない（過負荷を避ける = R-9 反映） |
| タッチターゲット | 行末アクション（編集・削除）は各 60px 幅 × 行高（44px 以上を維持）。`≡` ハンドルは `h-11 w-11` (44px) で UX-1 を 1 アイコン分先行解消 |
| 編集モーダル | `role="dialog" aria-modal="true" aria-labelledby="..."`、Esc キーで閉じる、開いた時に入力欄へフォーカス、閉じた時にスワイプを起動した行へフォーカスを戻す |
| アンドゥトースト | sonner の `action` ボタンに `aria-label="削除を取り消す"`、5 秒の自動消滅前にもキーボードでアクセス可能 |

### 3-8. Stage 1 レビュー記録

| 日付 | レビューファイル | 判定 | 対応 |
|------|-----------------|------|------|
| 2026-05-05 | [docs/reviews/20260505_022258_design-review-feature-phase11.md](../../reviews/20260505_022258_design-review-feature-phase11.md) | ⚠️ 条件付き承認 | code-reviewer 指摘 高5/中4/低2、product-advisor 指摘 高4/中3/低1。両者一致の重要懸念: 履歴画面の単発ボタン廃止 / `window.confirm` の UX 劣化 / iOS Safari エッジスワイプ / 60px 閾値 / dnd-kit 競合解消方針。**ユーザー判断 → Stage 1 修正 → 再レビュー**を予定 |

---

**→ Stage 1 確定後、`/design-review feature` → ユーザー承認 → Stage 2 へ進む**

---

## 4. 技術設計（Stage 2）

### 4-1. 作成・変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `package.json` | 変更 | `@use-gesture/react` 追加 |
| `src/features/shopping/stores/shoppingStore.ts` | 変更 | `updateItemName(id, name)` + `restoreItem(item)` アクション追加 |
| `src/features/shopping/components/SwipeableRow.tsx` | 新規 | 横スワイプで右端アクションを表示する汎用コンポーネント |
| `src/features/shopping/components/SortableItemRow.tsx` | 変更 | `setActivatorNodeRef` を `≡` ハンドルに付与、行本体を `SwipeableRow` でラップ |
| `src/features/shopping/components/ItemEditModal.tsx` | 新規 | 名前のみ編集する小モーダル |
| `src/features/shopping/components/ShoppingMainView.tsx` | 変更 | `openSwipeId` state、編集モーダル開閉、削除アンドゥトースト |
| `docs/features/20260504_phase10-sets-stores-categories.md` | 変更 | §3-C に Phase 11 完了で本方針が不要化される注記を追記 |
| `docs/設計書/技術負債と将来課題.md` | 変更 | UX-2（破壊的操作 UI 統一方針）/ UX-3（操作退行を伴う UI 変更時の周知）を新設 |

### 4-2. ストア API（`useShoppingStore`）

```typescript
type ShoppingActions = {
  // ... 既存
  updateItemName: (id: string, name: string) => void;
  /** 削除アンドゥ用に元アイテムを復元（同一 id・order・createdAt を維持） */
  restoreItem: (item: ShoppingItem) => void;
};

// 実装
updateItemName: (id, name) => set((state) => ({
  items: state.items.map((i) =>
    i.id === id
      ? { ...i, name: name.trim().slice(0, 50), updatedAt: new Date().toISOString() }
      : i,
  ),
})),

restoreItem: (item) => set((state) => {
  // 既に存在する場合は何もしない（多重アンドゥ防御）
  if (state.items.some((i) => i.id === item.id)) return state;
  return { items: [...state.items, item] };
}),
```

`updateItemName` は既存の `addItem` と同じく `updatedAt` を更新。Phase 9 同期で LWW に乗る。

### 4-3. `SwipeableRow` コンポーネント設計

**Props**:

```typescript
type SwipeAction = {
  label: string;
  onAction: () => void;
  color: "neutral" | "danger";
};

type Props = {
  children: React.ReactNode;     // 行本体
  actions: SwipeAction[];        // 行末に並ぶアクション（左から順）
  isOpen: boolean;               // 親が制御（同時 1 行制限）
  onOpenChange: (open: boolean) => void;
};
```

**動作**:

```typescript
import { useDrag } from "@use-gesture/react";

const ACTION_WIDTH = 60;               // px / アクション 1 個
const LOCK_THRESHOLD = 80;             // ロック判定 (Stage 1 §3-2)
const MAX_OFFSET = -ACTION_WIDTH * actions.length;  // -120 (2 アクション時)

const bind = useDrag(
  ({ down, movement: [mx], cancel, last }) => {
    // 右スワイプは無視
    if (mx > 0) {
      if (last) onOpenChange(false);
      return;
    }
    // 範囲制限
    const clamped = Math.max(mx, MAX_OFFSET);
    if (down) {
      setOffsetX(clamped);
    } else {
      // 指を離した時、80px 以上なら open、未満なら close
      const shouldOpen = -clamped >= LOCK_THRESHOLD;
      onOpenChange(shouldOpen);
      setOffsetX(shouldOpen ? MAX_OFFSET : 0);
    }
  },
  {
    axis: "x",
    axisThreshold: 5,                  // 5px までは方向確定しない
    filterTaps: true,                  // タップは無視
    bounds: { left: MAX_OFFSET, right: 0 },
    pointer: { touch: true },
  },
);

// isOpen の親側変更も追従
useEffect(() => {
  setOffsetX(isOpen ? MAX_OFFSET : 0);
}, [isOpen]);
```

**レイアウト**:

```tsx
<div className="relative overflow-hidden">
  {/* 行末アクション（背景に固定） */}
  <div className="absolute inset-y-0 right-0 flex">
    {actions.map((a, i) => (
      <button
        key={i}
        type="button"
        onClick={() => { a.onAction(); onOpenChange(false); }}
        className={`flex h-full w-[60px] items-center justify-center text-sm font-medium text-white ${
          a.color === "danger" ? "bg-red-500" : "bg-gray-500"
        }`}
        aria-label={a.label}
      >
        {a.label}
      </button>
    ))}
  </div>

  {/* 行本体（スライド） */}
  <div
    {...bind()}
    style={{
      transform: `translate3d(${offsetX}px, 0, 0)`,
      transition: dragging ? "none" : "transform 200ms ease-out",
      touchAction: "pan-y",
    }}
    className="relative bg-white"
  >
    {children}
  </div>
</div>
```

`touch-action: pan-y` で縦スクロールはブラウザに譲り、横スワイプのみ JS で捕捉。

### 4-4. `SortableItemRow` の改修

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

const {
  attributes,
  listeners,
  setNodeRef,
  setActivatorNodeRef,  // ← 重要: ハンドル要素にだけドラッグを起動させる
  transform,
  transition,
} = useSortable({ id: item.id });

return (
  <div ref={setNodeRef} style={{ transform, transition }} {...attributes}>
    <SwipeableRow
      actions={[
        { label: "編集", onAction: () => onEditRequest(item.id), color: "neutral" },
        { label: "削除", onAction: () => onDeleteRequest(item), color: "danger" },
      ]}
      isOpen={isOpen}
      onOpenChange={(o) => onOpenChange(o ? item.id : null)}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        {/* チェックボタン（既存） */}
        <CheckButton ... />
        {/* 名前 */}
        <span className="flex-1 truncate">{item.name}</span>
        {/* 区分移動アイコン（既存） */}
        <ScopeMoveButton ... />
        {/* ★ 新設: ドラッグハンドル（44px、タッチターゲット） */}
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          aria-label={`${item.name} を並び替え`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 touch-none active:bg-gray-100"
        >
          <GripVertical className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </SwipeableRow>
  </div>
);
```

`{...listeners}` をハンドル要素のみに付与し、`setActivatorNodeRef` で dnd-kit に「このノードがドラッグの起動点」と知らせる。これで行本体はドラッグを起動せず、`SwipeableRow` の `useDrag` だけが反応する。

### 4-5. 編集モーダル `ItemEditModal`

```tsx
type Props = {
  item: ShoppingItem;
  onSave: (newName: string) => void;
  onClose: () => void;
};
```

- 既存 `OnboardingModal` の overlay パターン（`fixed inset-0 z-50` + `role="dialog"`）を流用
- `<input type="text" maxLength={50} required>` で名前入力
- 保存: trim 後 1 文字以上必須、変更なしなら無効
- 保存後 `updateItemName(id, name)` → トースト「変更しました」 → モーダル閉じる
- Esc / ✕ / backdrop タップで閉じる
- 開いた時に入力欄へフォーカス、閉じた時にスワイプを起動した行（または `≡` ハンドル）へフォーカスを戻す

### 4-6. 削除アンドゥトースト

```tsx
const handleDelete = useCallback((item: ShoppingItem) => {
  deleteItem(item.id);
  toast(`「${item.name}」を削除しました`, {
    duration: 5000,
    action: {
      label: "元に戻す",
      onClick: () => {
        useShoppingStore.getState().restoreItem(item);
        toast.success(`「${item.name}」を復元しました`);
      },
    },
  });
}, [deleteItem]);
```

5 秒以内に「元に戻す」をタップすると `restoreItem` でフル復元。タイムアウト後は確定削除（既存 DeletionTombstone に乗り、Phase 9 同期で他端末へ伝播）。

### 4-7. `openSwipeId` の状態管理

`ShoppingMainView` のローカル state として `useState<string | null>(null)` で保持。`SortableItemRow` に `isOpen={openSwipeId === item.id}` と `onOpenChange={(o) => setOpenSwipeId(o ? item.id : null)}` を渡す。

副作用として、別の行をタップ・スワイプすると自動的に閉じる（state を上書きするため）。

### 4-8. パッケージ追加

```bash
npm install @use-gesture/react
```

依存: `@react-spring/core` 不要（`useDrag` のみ使う）。

### 4-9. ブラウザ評価計画

§5 で詳細化（実装後に code-review / browser-test で実証）。



---

## 5. ブラウザ評価計画

⚪ Stage 2 確定時に詳細化。Stage 1 時点での主要シナリオ骨子:

### 5-1. 対象画面（テスト対象）

| 画面 | URL | 新規/変更 |
|---|---|---|
| メイン画面 | `/` | 変更 |
| 履歴画面 | `/history` | 変更 |
| アイテム編集モーダル | （オーバーレイ）| 新規 |

### 5-2. 主要シナリオ（骨子）

1. メイン画面で行を左スワイプ → 編集ボタンが現れる → 編集 → 保存 → リスト表示も更新
2. 削除 → 確認 → リストから消える
3. ハンドル長押しで縦ドラッグ → 並び替えが従来通り動作
4. **行本体長押しでは並び替えが起動しない**
5. 別の行をスワイプ → 前の行は自動的に閉じる
6. 縦スクロール中に誤って横スワイプアクションが発動しない
7. iOS Safari のブラウザ戻るジェスチャー（左端スワイプ）が阻害されない
8. 履歴画面で「未購入に戻す」「削除」が動作する
9. 編集モーダルで Esc / キャンセル / 保存 / フォーカス戻し
10. 編集モーダルで空文字保存ができない
11. 50 文字超で入力できない
12. リロード後も編集内容が永続化されている

### 5-3. UX 評価の重点観点

| 観点 | 確認ポイント |
|---|---|
| 操作性 | 60px 閾値の体感が自然か。誤発動・閉じ忘れがないか |
| アニメーション | 200ms transition がもたつかないか |
| 視認性 | 削除ボタンの赤が「危険」を直感させるか、編集との区別が明確か |
| 一貫性 | メイン / 履歴で挙動が同じか |
| エラー状態 | 編集中に同 ID が他端末で削除された場合の挙動（Phase 10.1b/同期後の話なので Phase 11 ではメモのみ）|

---

## 6. 関連ドキュメント

| ドキュメント | 関連内容 |
|--------------|---------|
| [企画書 v0.3](../../企画書.md) | アイテム編集・削除のニーズに該当する記載があるか確認（Phase 11 として企画書に追加が必要か Stage 1 レビューで判断）|
| [Phase 5 設計書](./completed/20260504_phase5-sort-drag.md) | dnd-kit による既存縦ドラッグの実装。本フェーズで競合解消が必要 |
| [Phase 10.3 構想（保留中）](./20260504_phase10-sets-stores-categories.md) | §3-C「カテゴリ別表示時のみ行末に編集アイコン」方針は本フェーズで不要化 |
| [.claude/01_development_docs/09_開発フローと規模判定.md](../../../.claude/01_development_docs/09_開発フローと規模判定.md) | UX 変更を伴う L 規模の 2 段階設計フロー |
| [docs/設計書/フック一覧.md](../../設計書/フック一覧.md) | 実装後に `useShoppingStore.updateItemName` アクションを追記 |

---

## 7. 注意事項

- **dnd-kit との競合解消が最重要**。`{...listeners}` を行全体ではなくドラッグハンドル `≡` のみに限定する設計が前提。実装時は browser-test で「行本体の長押しで並び替えが起動しない」「ハンドルの長押しで並び替えが起動する」を必ず確認する
- **iOS Safari 戻るジェスチャー**は左端 ~20px 内側のスワイプで発動する。アクションは「左方向スワイプで右端から現れる」方向のため通常は干渉しないが、画面左端の行頭付近からの開始時のみ要確認
- **Phase 10.3 の編集アイコン方針との重複**: Phase 11 完了後、Phase 10.3 着手時には設計書 §3-C の編集 UI 部分を見直す。`docs/features/20260504_phase10-sets-stores-categories.md` §3-C-1 / §3-C-3 / §3-C-4 にコメントを残す（Stage 2 時に対応）
- **既存の `SortableItemRow` の変更は破壊的**。型定義変更ではなく挙動変更だが、ロングプレス可能領域が縮小するため既存ユーザーへの影響あり。次回リリースノート（実装後）でユーザー向けに告知する
- **クラウド同期 (Phase 9) との関係**: 編集・削除は既存の同期パイプラインに自動的に乗る（`updatedAt` 更新 + DeletionTombstone）。Phase 11 単体ではサーバ側の API 変更は不要
- **新規 npm パッケージ**: `@use-gesture/react` のみ追加。`framer-motion` 等は導入しない

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-05 | 9d5832f | 初版ドラフト作成（Stage 1 機能・画面設計）。横スワイプ + ドラッグハンドル分離方式を採用、`@use-gesture/react` を選定 | Claude Code |
| 1.1 | 2026-05-05 | (未確定) | Stage 1 レビュー指摘 5 件全採用 + Stage 2 技術設計を追記。履歴画面スコープ外 / アンドゥトースト / 80px 閾値 / setActivatorNodeRef / 44px ハンドル / Phase 10.3 注記 / UX-2/UX-3 を技術負債.md に登録 / キーボード SC 撤去 | Claude Code |
| 1.2 | 2026-05-05 | (未確定) | 実装完了。SwipeableRow / ItemEditModal / SortableItemRow ハンドル分離 / アンドゥ削除トースト / `updateItemName` + `restoreItem` ストアアクション。code-review (高2/中3/低2 全反映) / browser-test (16 シナリオ中 15 ✅ + 1 環境制限) / build OK。全体ステータス 🟢 完了 | Claude Code |
