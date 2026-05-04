# tools/

開発支援ツール・自動化スクリプト群。

## ファイル構成

```
tools/
├── README.md                          # このファイル
├── export-to-sql.ts                   # DB全量バックアップツール
├── dump.sql                           # バックアップ出力 (gitignore)
├── backup/                            # 日付付きバックアップアーカイブ (gitignore)
└── scripts/
    └── generate-table-docs.ts        # schema.prisma からテーブル定義書を自動生成
```

`tools/scripts/` 配下にはプロジェクトの作業用スクリプトを用途別に整理する（後述）。

---

## 各ファイルの説明

### `export-to-sql.ts` — DB全量バックアップツール

**用途**: PostgreSQL の全テーブルを TRUNCATE + INSERT 形式の SQL ファイルとしてエクスポートし、zip 圧縮してバックアップする。

**使い方**:
```bash
npx tsx tools/export-to-sql.ts
```

**出力**:
- `tools/dump.sql` — PostgreSQL 用の最新 SQL ファイル
- `tools/backup/dump_YYYYMMDD.zip` — 日付付きバックアップ（同日2回目以降は `_2`, `_3` ...）

**特徴**:
- 外部キー制約を考慮した順序でエクスポート
- `text[]` 配列、JSON、日付、boolean に対応

**呼び出されるタイミング**:
- 手動実行（任意のタイミングで安全のためバックアップ）
- **DBバックアップフック**（`.claude/settings.json`）が `npx prisma migrate` 実行**前**に自動実行
  - 失敗時は migrate がブロックされる

**プロジェクトへの適用**:
- スキーマ変更時は **3点同期** が必要（CLAUDE.md「DB スキーマ変更時の必須ルール」参照）:
  1. `prisma/schema.prisma`
  2. `docs/設計書/テーブル定義書.md`（自動生成）
  3. `tools/export-to-sql.ts` の `ORDERED_TABLES` + `DB_TABLE_MAP`
- ファイル冒頭の `ORDERED_TABLES` をプロジェクトのテーブル構成に合わせて編集する

---

### `scripts/generate-table-docs.ts` — テーブル定義書の自動生成

**用途**: `prisma/schema.prisma` を読み取り、`docs/設計書/テーブル定義書.md` を自動生成する。

**使い方**:
```bash
npx tsx tools/scripts/generate-table-docs.ts
```

**前提**:
- `prisma/schema.prisma` の各カラムに `/// 説明` コメントが付与されていること（CLAUDE.md「DB スキーマ変更時の必須ルール」参照）

**特徴**:
- model のフィールド・型・nullable・デフォルト値・インデックス・リレーション・Enum を網羅
- 手動でテーブル定義書を書くと乖離が最も発生しやすいため、自動生成に切り替えた経緯あり

**呼び出されるタイミング**:
- スキーマ変更後の手動実行
- `/sync-check` スキル内で差分確認の手段として利用

---

## `scripts/` ディレクトリの整理ルール

`tools/scripts/` 以下には、プロジェクトの作業用スクリプトを **用途別フォルダ** で整理する（CLAUDE.md「スクリプトの整理ルール」参照）。

### 推奨フォルダ構成（必要に応じて作成）

```
tools/scripts/
├── seed/         # テストデータ投入系
├── migration/    # データ移行系
├── analysis/     # データ分析・検証系
└── （その他用途別フォルダ）
```

### 新しいスクリプトを追加するときの指針

- **ルート直下（`tools/`）に直接置かない**: ルートはバックアップツール等の主要機能のみ
- **用途別フォルダに分類**: 既存のフォルダに該当しなければ新規作成
- **冒頭にコメントブロック**: 用途・使い方・前提条件を簡潔に記載（既存の `generate-table-docs.ts` を参考に）
- **シードデータ生成は AI 能力で**: アプリの AI API（Azure OpenAI 等）を開発ツールとして使わない（コスト・再現性のため）

---

## カスタマイズ・削除ガイド

本テンプレートを利用開始する際の判断材料:

| ファイル | Prisma を使う場合 | Prisma を使わない場合 |
|---------|-----------------|-------------------|
| `export-to-sql.ts` | テーブルを定義したら `ORDERED_TABLES` を編集 | **削除可** + DBバックアップフックも削除 |
| `scripts/generate-table-docs.ts` | そのまま利用可（schema.prisma に従う） | **削除可** + 関連スキルから参照を削除 |

Prisma 以外の ORM（Drizzle、TypeORM 等）を使う場合は、これらのツールを参考に独自のバックアップ・自動生成スクリプトを作成することを推奨。

---

## 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) — DB スキーマ変更時の必須ルール、スクリプトの整理ルール
- [docs/guide/バイブコーディング運用ガイド.md](../docs/guide/バイブコーディング運用ガイド.md) — 全体の設計思想
- [.claude/settings.json](../.claude/settings.json) — フック定義（DBバックアップフック）
