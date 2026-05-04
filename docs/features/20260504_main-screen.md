# 機能設計書: 買い物リスト Phase 2 — メイン画面（未購入リスト・単発追加・購入チェック）

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🟢 完了 |
| 変更の性質 | 新規追加 |
| 変更規模 | L（UX 変更を含む） |
| Stage 1（機能・画面設計）| ✅ 確定（事前承認） |
| Stage 2（技術設計） | ✅ 確定（事前承認） |
| 作成日 | 2026-05-04 |
| 最終更新 | 2026-05-04 |

> 本フェーズはユーザーが「実装完了までユーザー確認不要」と事前承認しているため、`/design-review` のゲートはスキップする。判断が必要な箇所は推奨案を採用する。

---

## 1. 概要

### 背景

[企画書 v0.3](../企画書.md) Phase 2。MVP のコア体験である **「未購入リストを見ながら、ワンタップで追加・購入チェック」** を実装する。Phase 3（一括追加）、Phase 4（区分タブ）、Phase 5（ソート/ドラッグ）、Phase 6（購入済み画面）、Phase 7（設定画面）は本フェーズには含めない。

### 目的

- 未購入アイテムが一目で見える縦スクロールの一覧画面を構築する
- 画面下部の入力欄から **単発追加**（Enter or 送信ボタン）ができる
- 各行のタップで **PENDING → PURCHASED** に切替（一覧から即時消える）
- LocalStorage への永続化が機能していることを確認する（hydration 対応含む）

### 方針

| 観点 | 判断 |
|------|------|
| 表示対象 | `status === 'PENDING'` の全アイテム（scope 区別はせず全件表示。タブ UI は Phase 4） |
| 並び順 | デフォルトの `CREATED_AT` ソート（古→新） |
| 新規追加先 scope | デフォルトの `TODAY`（Phase 4 でタブごとの追加に拡張） |
| 入力欄 | 画面下部に sticky 固定。Enter or 送信ボタンで追加。空文字は無視（ストア側で担保） |
| 行タップの挙動 | 行全体をタップで `togglePurchased`。即時にリストから消える |
| アニメーション | Phase 2 ではフェードアウト等のトランジションは入れず、即時 unmount で十分（§10.6 の議論は Phase 5 で詳細化） |
| ハイドレーション | `localStorage` は CSR でしか参照できないため、初回レンダリング時にスケルトン表示 → hydration 完了後に実データ表示 |
| コンポーネント分割 | `ShoppingMainView` (全体) / `ShoppingItemRow` (1行) / `AddItemForm` (入力欄) の3つに分割 |

---

## 2. タスク一覧

| # | フェーズ | タスク | ステータス | 備考 |
|---|---------|--------|-----------|------|
| 1 | Stage 1 | 機能・画面設計記入 | ✅ 完了 | |
| 2 | Stage 2 | 技術設計記入 | ✅ 完了 | |
| 3 | Phase 2 | `ShoppingMainView` 実装 | ✅ 完了 | スケルトン・空状態を内包 |
| 4 | Phase 2 | `ShoppingItemRow` 実装 | ✅ 完了 | memo 化、行全体タップ |
| 5 | Phase 2 | `AddItemForm` 実装 | ✅ 完了 | 空文字時は送信ボタン disabled |
| 6 | Phase 2 | `app/page.tsx` 差し替え | ✅ 完了 | |
| 7 | Phase 2 | ビルド・型チェック・lint 確認 | ✅ 完了 | 全クリーン |
| 8 | Phase 2 | ブラウザでの動作確認 | ✅ 完了 | 375px / Chrome 147 で全シナリオ確認: 空状態 → 4件追加 → 1件タップで消失 → リロードで残存 |

---

## 3. 機能・画面設計（Stage 1）

### 3-1. 対象画面と操作フロー

| 画面 | URL | 新規/変更 | 概要 |
|------|-----|----------|------|
| メイン | `/` | 変更（テンプレートのプレースホルダから差し替え） | 未購入リスト + 単発追加 + 購入チェック |

**操作フロー**:

1. ユーザーがアプリを開く → メイン画面が表示される
2. リストが空なら「リストは空です。下の入力欄から追加してください」と表示
3. 下部入力欄に商品名を入力 → Enter or 送信ボタン押下 → リスト最下部に追加される
4. リストの行をタップ → その行が即時にリストから消える（PURCHASED 状態に変化）

### 3-2. 画面レイアウト（375px 基準）

```
┌─────────────────────────────┐
│ 🛒 買い物リスト              │ ← ヘッダー（sticky top）
├─────────────────────────────┤
│                             │
│  ☐ 牛乳                    │ ← 行（タップ領域は行全体）
│  ☐ 卵                      │
│  ☐ パン                    │
│  ☐ 玉ねぎ                  │
│                             │
│  （以下スクロール）          │
│                             │
├─────────────────────────────┤
│ [追加したい商品名…   ]  [+] │ ← 入力欄（sticky bottom）
└─────────────────────────────┘
```

**空状態**:

```
┌─────────────────────────────┐
│ 🛒 買い物リスト              │
├─────────────────────────────┤
│                             │
│      🛒                     │
│   リストは空です            │
│   下の入力欄から            │
│   追加してください          │
│                             │
├─────────────────────────────┤
│ [追加したい商品名…   ]  [+] │
└─────────────────────────────┘
```

### 3-3. 受け入れ条件

- [x] 空のリスト時、空状態メッセージが表示される
- [x] 入力欄に商品名を入れて Enter で送信すると、リストに追加される
- [x] 入力欄に商品名を入れて送信ボタン（+）を押下すると、リストに追加される
- [x] 空文字や空白のみの入力では何も起きない（送信ボタンが disabled で押せない／Enter送信でも追加されない）
- [x] 行をタップすると、その行が即時に消える
- [x] ページをリロードしても、追加したアイテムが残っている（LocalStorage 永続化）
- [x] 入力欄が下部に固定されている
- [x] スマホ幅（375px）でレイアウトが崩れない
- [x] hydration 中の一瞬だけ簡易スケルトンが表示され、空状態のフラッシュが起きない

---

## 4. 技術設計（Stage 2）

### 4-1. 作成・変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/features/shopping/components/ShoppingMainView.tsx` | 新規 | メイン画面のコンテナ Client Component |
| `src/features/shopping/components/ShoppingItemRow.tsx` | 新規 | 1行コンポーネント（タップで購入済み化） |
| `src/features/shopping/components/AddItemForm.tsx` | 新規 | 下部固定の追加入力欄 |
| `src/app/page.tsx` | 変更 | プレースホルダを `<ShoppingMainView />` に差し替え |

### 4-2. コンポーネント API

#### `ShoppingMainView`

- Props なし
- `'use client'`
- `useShoppingStore` から `items` / `togglePurchased` を購読
- `useShoppingStore.persist.hasHydrated()` で hydration 状態判定 → 未完了時はスケルトン表示
- `pendingItems = useMemo(() => sortItems(items.filter(PENDING), sort), [items, sort])`

#### `ShoppingItemRow`

```typescript
type Props = {
  item: ShoppingItem;
  onToggle: (id: string) => void;
};
```

- `'use client'`、`memo` 化
- 行全体が `<button>` でタップ領域として機能
- 左端に円形チェック領域（未購入は空、Phase 5 以降のドラッグハンドル予定地でもある）

#### `AddItemForm`

- Props なし
- `'use client'`、`memo` 化
- ローカル `useState` で入力値を保持
- `useShoppingStore` から `addItem` を取得
- 送信時: trim 後の値で `addItem(value)` → 入力欄クリア
- Enter キーで送信（form 要素の `onSubmit`）

### 4-3. レイアウト構成

```tsx
<main className="mx-auto flex min-h-[100dvh] max-w-md flex-col">
  <header className="sticky top-0 z-10 ...">🛒 買い物リスト</header>
  <div className="flex-1 overflow-y-auto pb-2">
    {/* リスト or 空状態 */}
  </div>
  <div className="sticky bottom-0 z-10 border-t bg-white">
    <AddItemForm />
  </div>
</main>
```

- スマホで iOS Safari のアドレスバー伸縮に対応するため `min-h-[100dvh]`
- 下部入力欄は `sticky bottom-0`、`safe-area-inset-bottom` の余白を `pb-[env(safe-area-inset-bottom)]` で確保

### 4-4. ハイドレーション戦略

```tsx
const hasHydrated = useShoppingStore.persist.hasHydrated;
const [hydrated, setHydrated] = useState(false);
useEffect(() => {
  setHydrated(hasHydrated());
  const unsub = useShoppingStore.persist.onFinishHydration(() => setHydrated(true));
  return unsub;
}, [hasHydrated]);

if (!hydrated) return <SkeletonView />;
```

- `useShoppingStore.persist.hasHydrated()` は同期 API。`onFinishHydration` で完了通知も購読
- 未完了時は薄いスケルトン（タイトル + リスト枠のみ）

### 4-5. パフォーマンス考慮

- `ShoppingItemRow` を `memo` 化、`onToggle` は `useCallback` で安定化
- セレクタは個別 key で取得（`(s) => s.items` 等）して不要な再レンダリングを防ぐ

---

## 5. ブラウザ評価計画

### 5-1. 対象画面

| 画面 | URL | 新規/変更 |
|------|-----|----------|
| メイン | `/` | 変更 |

### 5-2. 前提条件

- [ ] dev サーバーが `http://localhost:3000` で起動済み
- [ ] LocalStorage は初期状態（既存データなし、もしくは初期化済み）

### 5-3. 機能テスト項目

| # | 操作手順 | 期待結果 |
|---|---------|---------|
| 1 | ページを開く | 「リストは空です」の空状態が表示される |
| 2 | 入力欄に「牛乳」と入力 → Enter | リストに「牛乳」が追加され、入力欄がクリアされる |
| 3 | 入力欄に「卵」「パン」を続けて追加 | リストに「牛乳」「卵」「パン」の順で表示される |
| 4 | 空文字で送信 | 何も追加されない |
| 5 | 「卵」の行をタップ | 「卵」が即時にリストから消える |
| 6 | ページをリロード | 「牛乳」「パン」が残っている |
| 7 | リストが画面いっぱいになるまで追加 | リストがスクロール可能、入力欄は画面下部に固定されたまま |

### 5-4. UX 評価の重点観点

| 観点 | 確認ポイント |
|------|-------------|
| レイアウト | 入力欄が下部に固定、ヘッダーが上部に固定、間がスクロール |
| 操作性 | 行のタップ領域が十分（44px 以上）。入力欄のフォーカスとキーボード挙動 |
| スマホ表示（375px） | レイアウト崩れなし、はみ出しなし |
| 空状態 | 空メッセージが分かりやすい |
| ハイドレーション | リロード時に空状態のフラッシュが起きない |

### 5-5. 評価シナリオ（E2E）

1. 起動 → 空状態確認
2. 「牛乳」「卵」「パン」を順に追加
3. 「卵」をタップして消える
4. リロード → 「牛乳」「パン」が残る

---

## 6. 関連ドキュメント

| ドキュメント | 関連内容 |
|-------------|---------|
| [企画書 v0.3](../企画書.md) | §6.2 メイン画面レイアウト、§4.1 F-01/F-03 |
| [Phase 1 設計書](./20260504_shopping-store基盤.md) | 利用するストア API |
| [Phase 1.5 設計書](./20260504_shopping-store-order追加.md) | order/MANUAL 拡張 |

---

## 7. 注意事項

- **`'use client'` を忘れない**。`useShoppingStore` を呼び出す全コンポーネントで必須
- LocalStorage は SSR で参照できない。hydration 完了後に値が確定する点を意識する
- iOS Safari の `100vh` 問題に注意。`100dvh` を使う
- `addItem` 内で trim・空文字チェックされているので、UI 側で重複チェック不要

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成 | Claude Code |
