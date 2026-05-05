# 機能設計書: Phase 12 — ボトムナビゲーションバー

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🟢 完了 |
| 変更の性質 | 改修（ナビゲーション UI の刷新） |
| 変更規模 | M（UX 変更だが画面遷移パターンの差し替えのみで限定的、対話で方針合意済み） |
| Stage 1（機能・画面設計）| ⚪ 不要（対話で方針確定済み） |
| Stage 2（技術設計） | ✅ 確定 |
| 作成日 | 2026-05-05 |
| 最終更新 | 2026-05-05 |

---

## 1. 概要

### 背景

スマホ専用アプリでありながら、ナビゲーション（履歴・設定など）を**右上ヘッダーのアイコン**に集約していた。
- ヘッダーアイコンは 36px (`h-9 w-9`) で UX-1（タッチターゲット未達 44px）にも該当
- 親指リーチエリア（画面下部 1/3）から最も遠い位置にあり片手操作で押しづらい
- 画面が増えるほどヘッダーが過密化（現状 5 アイコン）

### 目的

トップレベル画面（ホーム / 履歴 / セット / 設定）への遷移をスマホ標準の**ボトムナビゲーションバー**に移し、親指リーチで一発アクセスできるようにする。

### 方針

| 観点 | 判断 |
|---|---|
| ナビ位置 | **画面最下部に固定**（safe-area 考慮）。AddItemForm がある画面ではフォームの**さらに下**に配置 |
| タブ数 | **4 つ**（ホーム / 履歴 / セット / 設定）。アイコン + ラベル併記 |
| サブページの扱い | `/sets/new` `/sets/[id]` は**ボトムナビ非表示**（戻るボタンで親に戻る既存パターン維持） |
| 既存ヘッダーの履歴/設定リンク | 削除（ボトムナビに置換） |
| 既存ヘッダーのその他（同期・更新・並び替え）| メイン画面のコンテキスト操作なので**ヘッダーに残す** |
| 戻るボタン | トップレベル 4 画面ではヘッダーから削除。サブページのみ残す |
| アクティブタブ判定 | `usePathname()` を使用。`/sets`, `/sets/new`, `/sets/[id]` はすべて「セット」タブをアクティブに |
| タブの視覚表現 | 非アクティブ: gray-500 + 通常太さ / アクティブ: gray-900 + 太字 + 上端に小バー |
| タブのタッチターゲット | 各タブ高さ 56px 以上（icon 24 + gap + label + padding 計）で UX-1 をボトムナビ全体に適用 |
| 安全領域 | `pb-[env(safe-area-inset-bottom)]` でホームインジケータ（iOS）に被らない |
| ナビの永続化方法 | 共通 `BottomNav` コンポーネントを 4 画面でそれぞれ呼ぶ（`app/layout.tsx` には入れない。サブページで非表示にしたいため） |

---

## 2. タスク一覧

| # | タスク | ステータス | 備考 |
|---|--------|-----------|------|
| 1 | 設計書記入 | ✅ 完了 | 本書 |
| 2 | `BottomNav` 共通コンポーネント新規作成 | ✅ 完了 | `src/components/layout/BottomNav.tsx` |
| 3 | `ShoppingMainView` から履歴/設定リンクを削除し BottomNav 配置 | ✅ 完了 | AddItemForm の sticky 撤去 + safe-area 二重適用解消 |
| 4 | `HistoryView` から戻るアイコンを削除し BottomNav 配置 | ✅ 完了 | |
| 5 | `SettingsView` から戻るアイコンを削除し BottomNav 配置 | ✅ 完了 | |
| 6 | `SetListView` から戻るアイコンを削除し BottomNav 配置 | ✅ 完了 | |
| 7 | code-review / browser-test / build-check | ✅ 完了 | code-review: 高/中 0 件、低 3 件のメモのみ / browser-test: 全 13 項目合格 / build OK |
| 8 | update-docs / 設計書更新 / commit / push | ✅ 完了 | 本書 ✅ + completed/ 配置、`.doc-sync.md` 追記 |

---

## 3. 技術設計

### 3-1. 変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/components/layout/BottomNav.tsx` | 新規 | 4 タブのボトムナビ。`usePathname()` でアクティブ判定 |
| `src/features/shopping/components/ShoppingMainView.tsx` | 変更 | 履歴/設定リンク削除、最下部に BottomNav 追加 |
| `src/features/shopping/components/HistoryView.tsx` | 変更 | ヘッダー戻るアイコン削除、BottomNav 追加 |
| `src/features/shopping/components/SettingsView.tsx` | 変更 | ヘッダー戻るアイコン削除、BottomNav 追加 |
| `src/features/shopping/components/SetListView.tsx` | 変更 | ヘッダー戻るアイコン（`/settings` への戻る）削除、BottomNav 追加 |

**変更しないもの**:
- `SetEditView`（`/sets/new`, `/sets/[id]`）: サブページのため戻るボタン維持・BottomNav 非表示
- `LoginView`: ログイン画面はナビ非表示
- `OnboardingModal`: 全画面オーバーレイなのでナビは隠れる（既存挙動）
- `SetPickerSheet`: ボトムシートが BottomNav も含めて画面全体を覆う既存挙動を維持

### 3-2. `BottomNav` コンポーネント

```tsx
// src/components/layout/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
import { Clock, Home, ListChecks, Settings } from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { href: "/", label: "ホーム", icon: Home, isActive: (p) => p === "/" },
  { href: "/history", label: "履歴", icon: Clock, isActive: (p) => p === "/history" },
  { href: "/sets", label: "セット", icon: ListChecks, isActive: (p) => p === "/sets" || p.startsWith("/sets/") },
  { href: "/settings", label: "設定", icon: Settings, isActive: (p) => p === "/settings" },
];

export const BottomNav = memo(function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインナビゲーション"
      className="z-20 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition active:bg-gray-50 ${
              active ? "text-gray-900" : "text-gray-500"
            }`}
          >
            {active && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-gray-900" />}
            <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} aria-hidden />
            <span className={`text-xs ${active ? "font-bold" : "font-medium"}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";
```

### 3-3. レイアウトイメージ

```
ホーム画面 /
┌─────────────────────────────────┐
│ 🛒 買い物リスト    🔄 ↕         │ ← ヘッダー（同期・更新・並び替えのみ）
├─────────────────────────────────┤
│ 今日(3) また今度(0)              │ ← ScopeTabs
├─────────────────────────────────┤
│ ☐ 牛乳                          │
│ ☐ パン                          │ ← リスト本体
│ ...                             │
├─────────────────────────────────┤
│ 📋 [入力欄...........] ➕        │ ← AddItemForm
├─────────────────────────────────┤
│  ▔                              │
│ 🏠   🕐   📋   ⚙               │ ← BottomNav (4 タブ、アクティブは上端バー + 太字)
│ホーム 履歴  セット 設定          │
└─────────────────────────────────┘
       ↑ アクティブはホーム
```

```
履歴画面 /history
┌─────────────────────────────────┐
│ 購入済み                         │ ← 戻る矢印は削除
├─────────────────────────────────┤
│ 今日                             │
│ ☑ 卵                            │
│ ...                             │
├─────────────────────────────────┤
│ 🏠   🕐   📋   ⚙               │ ← アクティブは履歴
│ホーム 履歴  セット 設定          │
└─────────────────────────────────┘
              ↑ アクティブ
```

```
セット詳細 /sets/[id] （サブページ・ボトムナビ非表示）
┌─────────────────────────────────┐
│ ← セットを編集                   │ ← 戻る矢印は維持（サブページ）
├─────────────────────────────────┤
│ ...                             │
└─────────────────────────────────┘
（ボトムナビなし）
```

### 3-4. アクセシビリティ

- `<nav aria-label="メインナビゲーション">` でランドマーク
- 各タブは `<Link>` で `aria-current="page"` をアクティブ時に付与
- アイコンは `aria-hidden`、ラベルテキストがアクセシブルネーム
- アクティブインジケータ（上端バー）は `aria-hidden`（視覚補助のみ）

### 3-5. レイアウト調整詳細

各画面の `<main>` 構造は既に `flex min-h-[100dvh] flex-col` なので、最後に `<BottomNav />` を追加するだけで自然に最下部に配置される（`flex-1 overflow-y-auto` の中身がスクロール領域）。

`AddItemForm` を包む `<div>` の **`sticky bottom-0` は撤去**（flex 列レイアウトでは flex-1 のスクロール領域の外に置かれているため sticky は不要 = 既存の冗長指定）。`<BottomNav>` の上に密接して並ぶ。

`pb-[calc(0.75rem+env(safe-area-inset-bottom))]` の safe-area 二重適用を避けるため、`AddItemForm` 側の safe-area パディングを **削除し**、`BottomNav` 側のみで safe-area を吸収する。

具体的: `AddItemForm` の `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` → `pb-3` に変更。

---

## 4. ブラウザ評価計画

### 4-1. 主要シナリオ

| # | 操作 | 期待結果 |
|---|------|---------|
| 1 | `/` で BottomNav を確認 | 4 タブ表示、ホームがアクティブ（gray-900 + 太字 + 上端バー） |
| 2 | BottomNav の「履歴」タブをタップ | `/history` に遷移、履歴がアクティブ |
| 3 | BottomNav の「セット」タブをタップ | `/sets` に遷移、セットがアクティブ |
| 4 | BottomNav の「設定」タブをタップ | `/settings` に遷移、設定がアクティブ |
| 5 | `/sets` で「+」から `/sets/new` へ | BottomNav が**非表示**になる（サブページ） |
| 6 | `/sets/new` 保存 → `/sets` に戻る | BottomNav が再表示される |
| 7 | `/sets/[id]` を開く | BottomNav 非表示、戻る矢印は維持 |
| 8 | ホームの履歴/設定リンク | 削除されている |
| 9 | ホーム以外（履歴・設定・セット）の戻る矢印 | 削除されている |
| 10 | iOS Safari でホームインジケータと被らない | safe-area-inset-bottom が効いて余白が確保 |
| 11 | OnboardingModal | BottomNav も含めて全画面を覆う |
| 12 | SetPickerSheet（ボトムシート） | BottomNav も含めて全画面を覆う |
| 13 | アクティブタブの視覚状態 | 上端バー + 太字 + gray-900 で識別容易 |
| 14 | タッチターゲットサイズ | 各タブ約 56px の高さで 44px を上回る |

### 4-2. UX 評価観点

| 観点 | 確認ポイント |
|------|-------------|
| 操作性 | 親指リーチで全 4 タブを片手操作できるか |
| 視認性 | アクティブ/非アクティブの区別が一目で分かるか |
| 一貫性 | すべての画面で同じ位置・同じスタイル |
| レスポンシブ | 375px で 4 タブが均等に並ぶ（93px/タブ） |

---

## 5. 関連ドキュメント

| ドキュメント | 関連内容 |
|-------------|---------|
| [docs/設計書/技術負債と将来課題.md](../../設計書/技術負債と将来課題.md) | UX-1（ヘッダーアイコン 36px → 44px）が部分的に解消される。ヘッダーに残るアイコン（同期・更新・並び替え）は依然 36px のため UX-1 は解消には至らない |
| [docs/設計書/フック一覧.md](../../設計書/フック一覧.md) | 新規フックなし（`usePathname` は Next.js 標準） |

---

## 6. 注意事項

- `BottomNav` を `app/layout.tsx` には**入れない**。サブページ（`/sets/new`, `/sets/[id]`）で非表示にする要件のため、各トップレベル画面のコンポーネントから直接呼ぶ
- 既存ヘッダーから削除するもの: メイン画面の History/Settings リンク、`HistoryView` / `SettingsView` / `SetListView` の戻る矢印
- `AddItemForm` の safe-area 二重適用を避けるため、フォーム側パディングは `pb-3` に変更
- ログイン画面（`/login`）にはボトムナビを表示しない（未ログイン状態でナビが見える必要なし）

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-05 | (未確定) | 初版（軽量 Stage 2 設計書）。対話でボトムナビ化方針確定済みのため Stage 1 は省略 | Claude Code |
| 1.1 | 2026-05-05 | (未確定) | 実装完了。タスク #2-#8 を ✅ に更新、全体ステータスを 🟢 完了 へ。code-review (高/中 0 件 / 低 3 件メモ) / browser-test (全 13 項目合格) / build OK。設計書 §3-5 の「sticky bottom 維持」記述は実装で sticky 不要と判明したため `update-docs` でフォローアップ予定 | Claude Code |
