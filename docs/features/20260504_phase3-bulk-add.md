# 機能設計書: 買い物リスト Phase 3 — 一括追加（改行区切り）

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🟢 完了 |
| 変更の性質 | 改修 |
| 変更規模 | M |
| Stage 1（機能・画面設計）| ⚪ 不要（小規模 UX 変更、既存画面の入力欄のみ） |
| Stage 2（技術設計） | ✅ 確定（事前承認） |
| 作成日 | 2026-05-04 |
| 最終更新 | 2026-05-04 |

---

## 1. 概要

### 背景

[企画書 v0.3](../企画書.md) Phase 3。F-02（一括追加）を実装する。
Phase 1 でストアに `addItems` アクションは実装済み。本 Phase は **入力欄を textarea に変更し、改行区切りで複数アイテム追加できるようにする** UI 改修のみ。

### 目的

- ユーザーが「玉ねぎ\nにんじん\n豚肉」のように改行区切りで入力 → 1回の送信で全部追加できる
- 単一行入力（既存の挙動）も引き続き使える
- 入力欄は1行で開始し、入力に応じて自動で高さが伸びる（最大 160px ≒ 5行程度、上限超過時は内部スクロール）

### 方針

| 観点 | 判断 |
|------|------|
| 要素 | `<input>` → `<textarea rows={1}>` に変更 |
| 改行 | モバイルソフトキーボードの Return / Enter で改行（`<input>` だと送信になる） |
| 送信トリガー | 送信ボタンのみ（Enter は改行に取られるため） |
| 自動高さ調整 | `useEffect` で `scrollHeight` を測り、`min(scrollHeight, 160)` を高さに設定 |
| 分割ロジック | `value.split('\n')` してストアの `addItems` に渡す（trim・空行除外はストア側で処理） |
| 送信ボタン disable 条件 | trim 後の文字列が空 |
| Cmd/Ctrl+Enter での送信対応 | 物理キーボードでの利便のため対応する（モバイルにも害はない） |

---

## 2. タスク一覧

| # | フェーズ | タスク | ステータス | 備考 |
|---|---------|--------|-----------|------|
| 1 | Phase 3 | `AddItemForm` を textarea に変更 | ✅ 完了 | |
| 2 | Phase 3 | 自動高さ調整ロジックを追加 | ✅ 完了 | useRef + useEffect |
| 3 | Phase 3 | 送信時に `addItems` で改行分割追加 | ✅ 完了 | |
| 4 | Phase 3 | Cmd/Ctrl+Enter での送信対応 | ✅ 完了 | onKeyDown |
| 5 | Phase 3 | ビルド・型チェック・lint 確認 | ✅ 完了 | 全クリーン |
| 6 | Phase 3 | ブラウザ動作確認 | ✅ 完了 | 単発・改行4件・空行除外・スペース含む名前・160px 上限スクロールすべて確認 |

---

## 4. 技術設計（Stage 2）

### 4-1. 変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/features/shopping/components/AddItemForm.tsx` | 変更 | input → textarea、自動高さ、addItems で送信 |

### 4-2. 実装方針

```tsx
const ref = useRef<HTMLTextAreaElement>(null);
const addItems = useShoppingStore((s) => s.addItems);

useEffect(() => {
  const el = ref.current;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}, [value]);

const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  const names = value.split("\n");
  addItems(names, scope);
  setValue("");
};

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    formRef.current?.requestSubmit();
  }
};
```

### 4-3. アクセシビリティ

- `aria-label="商品名（改行で複数追加可能）"` に変更
- placeholder も「追加したい商品名… (改行で複数追加)」のような補足を入れる

---

## 5. ブラウザ評価計画

### 5-3. 機能テスト項目

| # | 操作手順 | 期待結果 |
|---|---------|---------|
| 1 | 単一行で「牛乳」と入力 → 送信ボタン | リストに「牛乳」が追加される（既存挙動の維持） |
| 2 | 改行を含めて「玉ねぎ\nにんじん\n豚肉」を入力 → 送信 | 3つのアイテムが順番に追加される |
| 3 | 「アイス クリーム」（スペース含む）を入力 → 送信 | 1つのアイテムとして「アイス クリーム」が追加される |
| 4 | 空行を含む「\n卵\n\n」を入力 → 送信 | 「卵」のみ追加される（空行は無視） |
| 5 | 入力欄に5行以上書く | 入力欄の高さが上限に達したら内部スクロールになる |
| 6 | Cmd/Ctrl+Enter | フォーム送信される |

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成 | Claude Code |
