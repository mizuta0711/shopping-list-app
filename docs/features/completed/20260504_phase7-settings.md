# 機能設計書: 買い物リスト Phase 7 — 設定画面（エクスポート/インポート/全削除）

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

[企画書 v0.3](../企画書.md) Phase 7。設定画面でデータ管理機能を提供する。

### 目的

- `/settings` ルートに設定画面を追加
- **JSON エクスポート**: 現在の状態を JSON ファイルとしてダウンロード
- **JSON インポート**: ファイルを読み込んで LocalStorage を上書き → ページ再読込
- **すべてのデータを削除**: 確認のうえ `reset()` でストアを初期化
- メイン画面ヘッダーに settings アイコンを追加

### 方針

| 観点 | 判断 |
|------|------|
| 並び順設定の重複 | メインヘッダーに既にあるため、設定画面には載せない（「データ管理 + アプリ情報」のみに絞る） |
| エクスポートのファイル名 | `shopping-list-YYYY-MM-DD.json` |
| インポートのバリデーション | `state.items` が配列で、各要素に `id` `name` `scope` `status` `createdAt` が含まれることを最低限チェック。版数は `version: 2` を付与してマイグレーションは不要 |
| 全削除の確認 | `window.confirm` で簡易確認（モーダル UI は MVP では不要） |
| エクスポート/インポート/削除の成功通知 | 簡易的に `alert()` で通知（トースト UI は MVP では不要） |
| アプリ情報 | バージョンを表示（`v0.1`） |

---

## 2. タスク一覧

| # | フェーズ | タスク | ステータス | 備考 |
|---|---------|--------|-----------|------|
| 1 | Phase 7 | エクスポート/インポートのユーティリティ関数 | ✅ 完了 | バリデーション付き |
| 2 | Phase 7 | `SettingsView` コンポーネント | ✅ 完了 | |
| 3 | Phase 7 | `app/settings/page.tsx` | ✅ 完了 | |
| 4 | Phase 7 | メイン画面ヘッダーに settings アイコン追加 | ✅ 完了 | Settings アイコン |
| 5 | Phase 7 | ビルド・型チェック・lint 確認 | ✅ 完了 | `/settings` ルート生成 |
| 6 | Phase 7 | ブラウザ動作確認 | ✅ 完了 | リセット動作確認(2件→0件) / インポート2件成功 |

---

## 4. 技術設計（Stage 2）

### 4-1. 作成・変更ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/features/shopping/utils/exportImport.ts` | 新規 | エクスポート/インポート用ユーティリティ |
| `src/features/shopping/components/SettingsView.tsx` | 新規 | 設定画面 UI |
| `src/app/settings/page.tsx` | 新規 | サーバーコンポーネント |
| `src/features/shopping/components/ShoppingMainView.tsx` | 変更 | settings アイコン追加 |

### 4-2. ユーティリティ関数

```typescript
export const exportStateToJson = (): void => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shopping-list-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const validateImported = (parsed: unknown): boolean => {
  // 最低限の構造チェック
};

export const importStateFromFile = async (file: File): Promise<boolean>;
```

### 4-3. 設定画面レイアウト

```
┌─────────────────────────────┐
│ ← 設定                       │
├─────────────────────────────┤
│ データ                       │
│ ┌──────────────────────┐    │
│ │ JSON でエクスポート   │    │
│ └──────────────────────┘    │
│ ┌──────────────────────┐    │
│ │ JSON からインポート   │    │
│ └──────────────────────┘    │
│ ┌──────────────────────┐    │
│ │ すべてのデータを削除   │    │ ← 赤系
│ └──────────────────────┘    │
│                             │
│ ─────────────────────────   │
│ アプリ情報                   │
│ shopping-list-app v0.1      │
└─────────────────────────────┘
```

---

## 5. ブラウザ評価計画

### 5-3. 機能テスト項目

| # | 操作手順 | 期待結果 |
|---|---------|---------|
| 1 | アイテム3件追加→`/settings` を開く | 設定画面が表示される |
| 2 | 「すべてのデータを削除」をタップ→キャンセル | データが残っている |
| 3 | 「すべてのデータを削除」→ OK | LocalStorage が初期状態にリセット、メイン画面に戻ると空状態 |
| 4 | エクスポート | （DOM レベルで `<a download>` クリックが発火することを確認、実際のダウンロードはスキップ） |
| 5 | インポート（モック JSON で） | LocalStorage が更新され、メインに戻ると該当アイテムが表示される |

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成 | Claude Code |
