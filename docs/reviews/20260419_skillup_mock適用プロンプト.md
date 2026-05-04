# skillup_mock へのフロー改訂適用プロンプト

本ファイルは、nextjs-claude-template の **フロー改訂（規模判定・2段階設計・UI/UX統合）** を
`D:/Develop/Web/skillup_mock/` プロジェクトに反映するための指示書。

使い方:
1. skillup_mock 側で新しい Claude Code セッションを起動
2. 本ファイル下記の「## Claude Code への指示プロンプト」を skillup_mock 側に投げる
3. 必要に応じて skillup_mock 側エージェントが `D:/Develop/Web/nextjs-claude-template/` を読みに行く

関連コミット（nextjs-claude-template 側）:
- Phase 1: `97ff697` 規模判定の明文化とバグ修正フローの順序明記
- Phase 1.5: `b560dba` CLAUDE.md 肥大化対策（要点と詳細の分離）
- Phase 2: `458e331` 機能設計書テンプレートを Stage 1/2 構造に変更
- Phase 3: `65740e3` /design-review のモード分割と UI/UX 設計観点の統合
- Phase 4: `ea26396` ガイド2種を新フロー対応に更新
- Phase 5: `dfbb6c2` 図2枚を新フロー対応に更新
- 完了移動: `a10f34a`

---

## Claude Code への指示プロンプト

```
nextjs-claude-template（パス: D:/Develop/Web/nextjs-claude-template/）に
フロー改訂が実施された。本プロジェクト (skillup_mock) にも同等の変更を反映してほしい。

## 前提・調査

skillup_mock は本テンプレートを適用したプロジェクトで、以下のような
プロジェクト固有カスタマイズがある可能性がある（これらは保持すること）:

- CLAUDE.md のプロジェクト概要・スタック情報・独自ルール
- `.claude/01_development_docs/` のプロジェクト固有設計方針
- 既存の機能設計書 (`docs/features/yyyymmdd_*.md`) は変更せず後方互換を保つ
- skillup_mock には既にテンプレ側と類似の機能が一部導入されている可能性あり
  （テンプレ自体が skillup_mock のノウハウを逆輸入した経緯がある）

作業開始前に以下を確認:

1. skillup_mock 側の現在の CLAUDE.md と `.claude/` 構成を把握
2. 以下のファイルが既に存在するか確認:
   - `.claude/01_development_docs/09_開発フローと規模判定.md`（新規のはず）
   - `docs/features/TEMPLATE.md`（Stage 1/2 構造かどうか）
   - `.claude/skills/design-review/SKILL.md`（モード対応しているか）
   - `.claude/agents/code-reviewer.md`（Stage 1/Stage 2 モード対応しているか）
3. 差分がある部分のみ反映する（既に同じ内容があれば上書きしない）

## 反映すべき変更サマリ

### 1. CLAUDE.md の変更（Phase 1 + 1.5）

#### 追加（セクション）
- 「規模判定の基準とプロセス」セクションを新設
  - AI 推測 → ユーザー承認 の2ステップ判定
  - AIバイアス補正（判定に迷ったら L 寄り）
  - スコープ拡大時の再判定ルール（現フェーズ完了後、破壊的変更は即停止）
  - 補助軸（新規/改修/バグ修正）
- 「バグ修正の原則」に以下を追加:
  - フロー順序: 原因特定 → 規模判定 → 必要なら設計書
  - 緊急バグ対応の2段構え（S暫定修正 → 後日M/L恒久対応）

#### ルール（重要）
- 上記のうち**詳細は別ドキュメント** `.claude/01_development_docs/09_開発フローと規模判定.md`
  に切り出し、CLAUDE.md には要点のみを残す
- CLAUDE.md 全体は約 250 行を目安に抑える（肥大化対策）

#### 既存セクションの変更
- S/M/L フロー表: UX変更を含む場合は自動的に L 扱いを明記
- L規模は2段階設計（Stage 1 → /design-review feature → Stage 2 → /design-review tech → 実装）
- バグ修正も S/M/L 判定の対象（S固定扱いをやめる）

### 2. 新規ドキュメント

`.claude/01_development_docs/09_開発フローと規模判定.md` を新規作成。
nextjs-claude-template 側の同ファイルをベースにするが、skillup_mock 固有の要素があれば統合。

含める内容:
- 規模判定の詳細（基準表、判定プロセス、AIバイアス補正、スコープ拡大時の再判定、補助軸）
- S/M/L フローの詳細
- バグ修正の詳細（フロー順序、緊急バグ対応、M/L規模の設計書書き方）
- 2段階設計の詳細（Stage 1/Stage 2、Stage 2→Stage 1 戻り手順）

### 3. 機能設計書テンプレート (`docs/features/TEMPLATE.md`) の変更（Phase 2）

- メタ情報に以下を追加:
  - 変更の性質（新規追加 / 改修 / バグ修正）
  - 変更規模（S / M / L）
  - Stage 1（機能・画面設計）ステータス（🔵記入中 / 🟡レビュー中 / ✅確定 / ⚪不要）
  - Stage 2（技術設計）ステータス
- セクション構造の変更:
  - 旧 `3. 設計詳細` → `3. 機能・画面設計（Stage 1）` + `4. 技術設計（Stage 2）` に分離
  - 旧 `4. ブラウザ評価計画` → `5. ブラウザ評価計画`（繰り下げ）
  - 旧 `5. 関連ドキュメント` → `6.`
  - 旧 `6. 注意事項` → `7.`
- Stage 1/2 それぞれに「レビュー記録」テーブルを追加
- 運用ガイドを Stage 1/2 構造に対応

既存の `docs/features/yyyymmdd_*.md` は**後方互換を保つ**（変換しない）。
新規に作成される設計書から新テンプレートが適用される。

### 4. `/new-feature` スキルの変更（Phase 2）

- Step 1 を追加: 変更の性質・規模をユーザー確認
  - AI が推測して提示 → ユーザー承認
  - 判定に迷ったら L 寄り、UX変更ありは自動的に L
- 規模に応じた Stage 1/2 ステータス初期値を設定:
  - L: Stage 1 = 🔵記入中, Stage 2 = ⚪未着手
  - M (UX変更なし): Stage 1 = ⚪不要, Stage 2 = ⚪未着手
  - S: Stage 1 = ⚪不要, Stage 2 = ⚪不要

### 5. `/design-review` スキルの変更（Phase 3）

- 引数でモード切替: `feature` / `tech` / 省略（互換モード）
- **feature モード**:
  - code-reviewer（設計整合性 + UI/UX設計）と product-advisor（企画・UX体験）を並列起動
  - 統合フォーマット: code-reviewer のテーブル + product-advisor のテーブル + 競合テーブル
  - 矛盾・タイムアウト時の扱いを定義
- **tech モード**:
  - code-reviewer のみ起動（API/DB/サービス/フックの整合性）
- **互換モード**（引数なし）:
  - 従来の全項目チェック（Stage 分離されていない設計書向け）
- 部分読み戦略: モード別に必要なセクションだけ offset/limit で読む
- Stage 別のレビュー記録を機能設計書に自動追記

### 6. `code-reviewer` エージェントの変更（Phase 3）

3つのレビューモードを明記:
- **Stage 1 設計レビュー**: 設計書整合性 + UI/UX 設計観点（デザインシステム準拠、レイアウト、アクセシビリティ、レスポンシブ、コンポーネント再利用）
- **Stage 2 設計レビュー**: API/DB/サービス/フックの整合性
- **互換モード**: Stage 分離されていない設計書向け
- **実装レビュー**: 従来通り

**役割分担の明記**: Stage 1 では UX 体験観点は product-advisor が担当するため、
code-reviewer は扱わない。

### 7. ガイドの変更（Phase 4）

以下のファイルが skillup_mock に存在する場合のみ更新:
- `docs/guide/バイブコーディング運用ガイド.md`
  - S/M/L フロー表を2段階設計対応に
  - L規模フロー図を Stage 1/2 構造に刷新
  - code-reviewer / product-advisor / /design-review の説明を更新
  - 機能設計書構造を Stage 1/2 に
  - 落とし穴を3件追加（要件の誤解、規模判定バイアス、CLAUDE.md 肥大化）
- `docs/guide/バイブコーディング入門ガイド.md`
  - 失敗パターン #15 忖度への誘導: product-advisor の Stage 1 統合を追記
  - 仕組みマップに2段階設計・規模判定バイアス等を追加
  - セクション番号参照を 4→5 に更新

もし skillup_mock にこれらのガイドがない場合は作成不要（スキップ）。

### 8. 図の変更（Phase 5）

以下のファイルが skillup_mock に存在する場合のみ更新:
- `docs/diagrams/02_開発フロー図.drawio`
- `docs/diagrams/05_全体アーキテクチャ図.drawio`

**存在しない場合は作成不要**（skillup_mock 側で独自の図管理があればそちらを尊重）。

## 反映の順序

依存関係を考慮して以下の順で実施:

1. **新規ドキュメント作成**: `.claude/01_development_docs/09_開発フローと規模判定.md`
2. **CLAUDE.md の更新**: 規模判定・バグ修正原則の追加 + 肥大化対策（09_*.md への参照）
3. **TEMPLATE.md の更新**: Stage 1/2 構造化
4. **`/new-feature` スキルの更新**: Step 1 追加
5. **`/design-review` スキルの更新**: モード追加
6. **`code-reviewer` エージェントの更新**: Stage 1/Stage 2 モード追加
7. **ガイドの更新**（存在する場合のみ）
8. **図の更新**（存在する場合のみ）

各ステップごとにフェーズ単位でコミットすることを推奨。
（Phase 1, Phase 1.5, Phase 2 ... のように）

## skillup_mock 固有のチェック観点

以下は**上書きしない・保持する**:

1. **CLAUDE.md のプロジェクト概要**: 「AIペット型パーソナル学習アシスタント」等の記述
2. **スタック情報**: Next.js 16, Prisma 6 等の固有バージョン
3. **画面レイアウトルール**: `h-dvh + flex-col` 等の skillup_mock 固有ルール
4. **DBスキーマ変更時のルール**: `tablet:` ブレークポイント、skillup_mock 固有の3点同期
5. **機能設計書**: 既存の `docs/features/yyyymmdd_*.md` は後方互換のため変更しない
6. **固有エージェント・スキル**: skillup_mock 独自のものがあれば保持
7. **既存のルールで、テンプレ側にはない skillup_mock 独自のもの**: 必ず保持

判断に迷う場合は**変更前にユーザーに確認**すること。

## 反映元の参照方法

nextjs-claude-template 側の対応ファイル（差分取得元）:

| 反映対象 | 参照元パス |
|---------|-----------|
| CLAUDE.md | `D:/Develop/Web/nextjs-claude-template/CLAUDE.md` |
| 09_開発フローと規模判定.md | `D:/Develop/Web/nextjs-claude-template/.claude/01_development_docs/09_開発フローと規模判定.md` |
| TEMPLATE.md | `D:/Develop/Web/nextjs-claude-template/docs/features/TEMPLATE.md` |
| /new-feature | `D:/Develop/Web/nextjs-claude-template/.claude/skills/new-feature/SKILL.md` |
| /design-review | `D:/Develop/Web/nextjs-claude-template/.claude/skills/design-review/SKILL.md` |
| code-reviewer | `D:/Develop/Web/nextjs-claude-template/.claude/agents/code-reviewer.md` |
| 入門ガイド | `D:/Develop/Web/nextjs-claude-template/docs/guide/バイブコーディング入門ガイド.md` |
| 運用ガイド | `D:/Develop/Web/nextjs-claude-template/docs/guide/バイブコーディング運用ガイド.md` |
| 開発フロー図 | `D:/Develop/Web/nextjs-claude-template/docs/diagrams/02_開発フロー図.drawio` |
| アーキテクチャ図 | `D:/Develop/Web/nextjs-claude-template/docs/diagrams/05_全体アーキテクチャ図.drawio` |
| 設計書（参考） | `D:/Develop/Web/nextjs-claude-template/docs/features/completed/20260419_フロー改訂_規模判定と2段階設計.md` |

**重要**: 参照元を丸ごとコピーするのではなく、**差分を判断して反映**すること。
skillup_mock の現状と照らし合わせ、必要な変更のみを加える。

## 検証チェックリスト

反映完了後、以下を確認:

- [ ] CLAUDE.md が約 250 行程度に収まっている（肥大化していない）
- [ ] CLAUDE.md から 09_開発フローと規模判定.md への参照が一方向（09 側から CLAUDE.md を深く参照しない）
- [ ] 09_開発フローと規模判定.md が skillup_mock 固有のスタック情報と矛盾しない
- [ ] TEMPLATE.md のセクション番号が整合している（3-1, 3-2, 3-3 / 4-1〜4-5 / 5 / 6 / 7）
- [ ] `/new-feature` の Step 1 で変更の性質・規模を確認する動作が明記されている
- [ ] `/design-review` の feature/tech/省略 モード分岐が明記されている
- [ ] code-reviewer のレビューモードが Stage 1/Stage 2/互換/実装 の4種類に整理されている
- [ ] ガイドのセクション番号参照が 4→5 になっている（「4. ブラウザ評価計画」→「5. ブラウザ評価計画」）
- [ ] 既存の `docs/features/yyyymmdd_*.md` は変更されていない（後方互換）
- [ ] skillup_mock 固有のカスタマイズ（プロジェクト概要、スタック、独自ルール）が保持されている

## 完了報告

全フェーズ完了後、以下を `/done` フォーマットで報告:

- 反映したフェーズ（1, 1.5, 2, 3, 4, 5）
- 新規作成・更新したファイル一覧
- skillup_mock 固有部分で保持した内容
- スキップした項目（skillup_mock に存在しなかったもの等）
- 検証結果（チェックリストの結果）

各フェーズごとに独立したコミットにしてください（例: Phase 1 = 1コミット、Phase 1.5 = 1コミット 等）。
```

---

## ユーザー向け補足

### 使い方手順

1. skillup_mock 側で Claude Code を起動（作業ディレクトリ: `D:/Develop/Web/skillup_mock`）
2. このファイル（`20260419_skillup_mock適用プロンプト.md`）の **「## Claude Code への指示プロンプト」** セクション内のコードブロック全体をコピー
3. skillup_mock セッションに貼り付け
4. エージェントが現状調査 → 差分適用 → コミット を自動で進める

### 想定作業時間

- 調査・差分判定: 10〜15分
- 反映作業（6フェーズ分）: 30〜40分
- 検証・コミット: 10分
- **合計: 約1時間**

### トラブル時の対処

- **skillup_mock 側に既に同じ内容がある**: エージェントが「既に存在」と報告 → スキップ
- **skillup_mock 固有の記述と衝突**: エージェントが「要確認」と報告 → ユーザーが判断
- **エージェントが判断に迷う**: ユーザーに質問 → 指示を返す

### nextjs-claude-template 側の参照について

skillup_mock 側エージェントが `D:/Develop/Web/nextjs-claude-template/` を読むには、
Claude Code の `additionalDirectories` 設定で読み取り権限が必要な場合あり。
設定済みの場合はそのまま参照可能。
