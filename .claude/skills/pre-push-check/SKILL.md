---
name: pre-push-check
description: git push前に必ず実行する。未プッシュの全コミットが設計書に同期済みかをgrepで高速チェックする。
---

# プッシュ前 設計書同期チェック

git push の前に必ず実行すること。`docs/設計書/.doc-sync.md` に全コミットハッシュが記録されているかを grep で確認する。

## Step 1: 未同期コミットの高速検出

```bash
# 未プッシュコミットのハッシュ一覧を取得
HASHES=$(git log --format=%h @{upstream}..HEAD 2>/dev/null)

# 各ハッシュが .doc-sync.md に記録されているか grep で確認
# ソースコード変更を含まないコミット（docs/, .claude/ のみ）はスキップ
for hash in $HASHES; do
  FILES=$(git diff-tree --no-commit-id --name-only -r $hash)
  HAS_SRC=false
  for f in $FILES; do
    case "$f" in src/*|prisma/*) HAS_SRC=true; break ;; esac
  done
  if [ "$HAS_SRC" = false ]; then
    echo "SKIP: $hash (ソースコード変更なし)"
    continue
  fi
  grep -q "$hash" docs/設計書/.doc-sync.md || echo "MISSING: $hash"
done
```

## Step 2: 判定

- **MISSING なし** → `✅ プッシュ可能` と報告。完了。
- **MISSING あり** → 該当コミットの変更内容を `git show --stat {hash}` で確認し、`/update-docs` を実行して設計書を更新。更新後、再度 Step 1 を実行して全ハッシュが記録されたことを確認。

**全コミットが記録されるまでプッシュしないこと。**

## Step 3: 結果報告

```
## プッシュ前チェック結果

### チェック対象: N件のコミット（スキップ: M件）
### 未同期: 0件（または K件 → 修正済み）
### 判定: ✅ プッシュ可能
```
