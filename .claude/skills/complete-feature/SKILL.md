---
name: complete-feature
description: "機能設計書の完了処理。全タスク完了後、sync-checkで設計書の整合性を確認し、completed/に移動する。"
user_invocable: true
---

# 機能設計書の完了処理

M/Lフローの最後に実行する。設計書の全タスクが完了した後、設計書と実装の整合性を確認してから completed/ に移動する。

## Step 1: 対象の設計書を特定

引数でファイル名が指定されている場合はそれを使用。
未指定の場合は `docs/features/` 配下の設計書一覧を表示し、ユーザーに選択を求める。

```bash
ls docs/features/*.md | grep -v TEMPLATE
```

## Step 2: タスク完了チェック

対象の設計書を読み、タスク一覧のステータスを確認:
- 🔵未実施 / 🟡実装中 のタスクが残っていたら、完了処理を中断
- ✅完了 / ⏸️保留 / ❌却下 のみなら次のステップへ

## Step 3: /sync-check 実行

設計書の変更内容に関連する設計書のみを対象に整合性チェックを実行。

### チェック対象の判定

設計書の「作成・変更ファイル」セクションから変更対象を読み取り、以下のチェックを実行:

#### API関連の変更がある場合
```bash
# 実装されているAPIエンドポイントを列挙
find src/app/api -name "route.ts" | sort
```
→ `docs/設計書/API一覧.md` のエンドポイント一覧と照合

#### サービス関連の変更がある場合
```bash
# 各サービスファイルの export 関数を列挙
grep -rn "^export async function\|^export function" src/lib/services/ --include="*.ts" | head -100
```
→ `docs/設計書/サービス・リポジトリ一覧.md` のメソッド一覧と照合

#### スキーマ変更がある場合
```bash
# テーブル定義書を自動生成して差分確認
npx tsx tools/scripts/generate-table-docs.ts
git diff docs/設計書/テーブル定義書.md
```

#### フック変更がある場合
```bash
# フック一覧
find src/features -path "*/hooks/*.ts" | sort
```
→ `docs/設計書/フック一覧.md` と照合

### 乖離が見つかった場合
- 乖離内容を一覧で報告
- 自動修正可能なもの（メソッド追加・削除の反映等）は修正を実行
- 修正後、改訂履歴を更新
- 修正が複雑な場合はユーザーに確認を求める

### 乖離がない場合
- 「✅ 設計書と実装は同期済み」と報告

## Step 4: 完了処理

1. 設計書のメタ情報のステータスを更新:
   - ✅ と ❌ のみ → 🟢 完了
   - ⏸️保留 が1つ以上ある → ⏸️ 一部保留

2. 移動:
   - 🟢 完了 → `docs/features/completed/` に移動
   - ⏸️ 一部保留 → `docs/features/` に残す（移動しない）

3. 結果報告:
```
## 完了処理結果

### 設計書: {ファイル名}
### sync-check: ✅ 同期済み / ⚠️ N件修正
### ステータス: 🟢 完了 → completed/ に移動 / ⏸️ 一部保留
```
