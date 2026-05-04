# Stage 2 設計レビュー結果（Phase 10.1 セット機能）

- 実施日時: 2026-05-04 14:42
- 対象: `docs/features/20260504_phase10.1-sets.md`
- モード: tech (Stage 2)
- 親設計書: `docs/features/20260504_phase10-sets-stores-categories.md`

## 総合判定

⚠️ **条件付き承認**

実装着手前に下記「要修正」テーブルの **重要度=高（#1〜#4）** を反映すること。中・低項目は採否をユーザー判断で決定する。

---

## code-reviewer（設計整合性 + 技術設計）

| # | 重要度 | 種別 | 指摘内容 | 該当箇所 | 推奨対応 |
|---|--------|------|----------|----------|----------|
| 1 | 高 | 実装漏れ | `SetPickerSheet` でセット追加時の追加件数計算方法が未指定。`AddItemForm` は `before/after` 差分で計算しているが、Sheet 側でも同パターンを使う旨が書かれていない | §5-5、§6-3 | 「追加件数の計算は `useShoppingStore.getState().items.length` の before/after 差分で行う（`AddItemForm` と同一パターン）」を §5-5 に追記 |
| 2 | 高 | z-index | `SetPickerSheet` の overlay z-index が未指定。`AddItemForm` 親が `z-10` (sticky bottom)、ヘッダーが `z-10`。これらを上回る `z-50` 以上の指定が必要 | §5-5、§5-6 | overlay に `z-50` 以上を明示。バックドロップ・確認モーダルの順序関係も合わせて記述 |
| 3 | 高 | API 矛盾 | `addSet` は無効入力時に `set(...)` をスキップするのに id を返す設計。「ストアに追加されていないが id だけ返る」状態となり呼び出し側を誤解させる | §4-1 | 戻り値を `string \| null` に変更し UI 側で null チェック。または「事前バリデーション必須」を強制するため throw する設計に変更 |
| 4 | 高 | 実装手順の曖昧さ | hydration guard を「`persist.hasHydrated()` で guard」とのみ記述。`ShoppingMainView` のように `useState` + `onFinishHydration` のパターンを具体化していない | §5-3 | `SetListView` / `SetEditView` の hydration guard を `ShoppingMainView` と同一パターンで記述（コード例を併記） |
| 5 | 中 | 遷移仕様 | edit モード保存後 `router.back()`、削除後 `router.replace('/sets')` と挙動が分かれている。deeplink 経由で来た場合に `back()` が意図しない遷移を起こす | §5-4 | `edit` の保存後も `router.replace('/sets')` に統一する、または前提（直前ページが必ず `/sets`）を明示 |
| 6 | 中 | 既存違反 | 既存 `SettingsView` は `memo` / `displayName` 未適用。本フェーズで変更時に CLAUDE.md ルール（memo+displayName）に合わせるかを判断していない | §5-7 | 「既存パターンを踏襲し変更は最小限に留める」「同フェーズで memo 化する」のどちらかを設計書で確定 |
| 7 | 中 | バリデーション | セット名 50 文字超の入力抑制手段（`maxLength` か onChange エラー）が §7-1 に明記されていない。§9-1 シナリオ #10 に対応する仕様が抜けている | §7-1 | セット名 input に `maxLength={50}` を付与する旨を記述。商品名側は既述（slice 防御）と区別 |
| 8 | 中 | アクセシビリティ | ボトムシート内の確認モーダル（モーダル on モーダル）の ARIA 設計が未定義。ネスト dialog はブラウザ依存挙動 | §5-5、§6-2 | `role="alertdialog"` で独立化、または `window.confirm` 代替（既存 `SettingsView` リセット確認と同方式）にする選択を明記 |
| 9 | 低 | 命名不一致 | §5-4 の説明文では `parseSetItemNames`、コードスニペットでは `parseItemNames`。関数名が不一致 | §5-4 | `parseItemNames` に統一 |
| 10 | 低 | 将来互換 | §8 のクラウド同期メモが、Phase 9 の決定事項「`updatedAt` クライアント発行 / `@updatedAt` 不使用」に明示的に触れていない | §8 | Phase 9 と同じ「クライアント発行 `updatedAt` / `@updatedAt` 不使用」方針を踏襲する旨を一行追記 |
| 11 | 低 | テスト網羅 | §9-1 に「hydration 完了前にセットアイコンをタップ」のシナリオがない | §9-1 | hydration 中の挙動（無効化 or skeleton）を確認するシナリオを追加 |

---

## 良い点

- **型設計の先読み**: `updatedAt` を必須フィールドにして Phase 9 LWW との統合余地を残している
- **LocalStorage 別キー分離**: main store の `STORAGE_VERSION` を上げずに済む判断は適切で、既存ユーザー影響ゼロ
- **`sanitizeItems` の二重防御**: ストア層・UI 層の責務分離が明示されている
- **Next.js 16 `params: Promise` 対応**: 注意書き付きで実装者が踏み外すリスクが低い
- **375px 幅計算の明示**: 固定幅 120px / 残り 255px と数値が出ているため実装時の迷いを防げる
- **Phase 9 との UUID v4 整合**: `crypto.randomUUID()` がクラウド同期設計と完全一致

---

## 補足コメント（ユーザー判断が必要な点）

1. **#3 の `addSet` 戻り値**: `string | null` 化はコール側の null チェックが必要になる。代替として「id は呼び出し側で先に生成 → ストアに渡す」設計（既存 `useShoppingStore.addItem` と同じく内部 ID 生成）に揃えると、戻り値を持たない素直な設計にできる。
2. **#8 のモーダル on モーダル**: `window.confirm` 代替は UX を犠牲にするが、既存 `SettingsView` のリセット確認と同方式なら一貫性は保てる。`alertdialog` で独立化するなら focus management の追加コストあり。
3. **`parseItemNames` の共通化スコープ**: §5-4 では新規利用箇所のみで `AddItemForm` のリファクタは別タスク扱い。将来の乖離リスクを下げるなら同フェーズで `AddItemForm` も寄せる選択肢あり（スコープ判断はユーザー）。

---

## 次工程

ユーザー承認後、上記「要修正・重要度=高」の修正を設計書に反映 → 実装フェーズに進む。
