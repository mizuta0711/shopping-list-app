# Stage 2 設計レビュー結果 — Phase 9 クラウド同期

- 実施日時: 2026-05-04 14:18
- 対象: `docs/features/20260504_phase9-cloud-sync.md` §4 技術設計（Stage 2）
- モード: tech (Stage 2)
- 使用エージェント: code-reviewer (sonnet)

## 総合判定: ⚠️ 条件付き承認

T1〜T6 の Critical 6 件は実装前に必ず解消が必要。T7〜T14 の Major 8 件のうち T7 / T14 は同期コアロジックに関わるため設計修正が実装着手の条件。

## 指摘一覧

| # | 重要度 | カテゴリ | 内容 | 該当箇所 | 推奨対応 | 対応状況 |
|---|--------|---------|------|---------|---------|---------|
| T1 | 🔴 Critical | Auth.js パス不整合 | `route.ts` が `@/lib/auth/handlers` を import しているが、`src/lib/auth.ts`（単一ファイル）から export される `handlers` の正しい参照は `@/lib/auth`。実行時エラーになる | §4-3 `route.ts` | `export { GET, POST } from "@/lib/auth"` に修正 | ✅ 対応済み (v1.3) |
| T2 | 🔴 Critical | API route ラッパー方針 | `04_error_handling_design.md` に `withAuth()` ラッパー設計があるが `src/lib/api/` 未実装。sync route は `auth()` 直接呼ぶ設計と乖離 | §4-5 サーバー処理 | Phase 9 で `src/lib/api/withAuth` を実装するか、sync route は手動 try-catch で統一するか方針を明記 | ✅ 対応済み (v1.3) |
| T3 | 🔴 Critical | レスポンス JSON 例の省略 | `PUT /api/sync/items` と `POST /api/sync/merge` のレスポンスが「`SyncPushResponse 参照`」のみで JSON 例がない。CLAUDE.md ルール違反 | §4-5 PUT・POST レスポンス | 2エンドポイント分のレスポンス JSON 例を具体値で記載 | ✅ 対応済み (v1.3) |
| T4 | 🔴 Critical | deletedIds の所有権チェック条件が不正確 | `updatedAt < new Date()` という条件は常に true になり、所有権防御が空に見える | §4-5 PUT サーバー処理ステップ3 | `WHERE userId = session.user.id AND id IN (deletedIds)` のみで十分と修正 | ✅ 対応済み (v1.3) |
| T5 | 🔴 Critical | 共有型に userId フィールドの扱いが未定義 | FE の `ShoppingItem` には `userId` がなく、API レスポンス型と Prisma 型が乖離 | §4-4, §4-1 | クライアント向け型（`userId` なし）とサーバー内部型を分離するか、`Omit<PrismaShoppingItem, 'userId'>` で明示 | ✅ 対応済み (v1.3) |
| T6 | 🔴 Critical | hasMerged フラグのキーがコード例と説明で矛盾 | コード例は固定キー `sync:hasMerged`、文章は `sync:hasMerged:${userId}`。実装者が誤解するリスク | §4-9 | コード例を `sync:hasMerged:${session.user.id}` に統一、ログアウト時のキークリア処理も明示 | ✅ 対応済み (v1.3) |
| T7 | 🟡 Major | GET 差分取得で削除が伝播しない | `GET` レスポンスに `serverDeletes` がなく、PUT を経ない focus/online トリガでは別端末削除を検知できない | §4-5 GET, §4-6 同期トリガー | `GET` レスポンスにも `serverDeletes: string[]` を追加 | ✅ 対応済み (v1.3) |
| T8 | 🟡 Major | reconcile での LWW 比較とクロックずれ補正の関係が未明示 | `updatedAt` 文字列比較の前後でクロックずれ補正をどう扱うか不明 | §4-6 reconcile | 「補正は発行時のみ、比較は受信値そのまま」と明記 | ✅ 対応済み (v1.3) |
| T9 | 🟡 Major | pendingUpsertIds が Set で persist 不可 | Zustand persist で Set はシリアライズできず `{}` になる | §4-6 syncStore | `partialize` で `lastUpdatedAt` のみ保存と明記 | ✅ 対応済み (v1.3) |
| T10 | 🟡 Major | API パスバージョニング不整合 | `03_api_design.md` は `/api/v1/...`、設計書は `/api/sync/items` | §4-5, `03_api_design.md` | 方針統一して両方に記載 | ✅ 対応済み (v1.3) |
| T11 | 🟡 Major | Prisma コネクションプール未考慮 | Vercel + Neon 無料枠は接続数厳しく、`connection_limit` 指定がないと枯渇 | §4-1, `src/lib/db.ts` | `DATABASE_URL` に `?connection_limit=5&pool_timeout=10` を追記 | ✅ 対応済み (v1.3) |
| T12 | 🟡 Major | since: null の扱いが曖昧 | 初回 PUT で `since: null` 送ると全期間差分が返り得る | §4-5 PUT 設計判断 | 「初回 PUT 前に GET で lastUpdatedAt を取得」フロー明記 | ✅ 対応済み (v1.3) |
| T13 | 🟡 Major | LWW の同値時挙動が未定義 | `existing.updatedAt >= input.updatedAt` で同値時にスキップする意図が不明 | §4-5 PUT サーバー処理 | 「同値時はサーバー側を正、冪等性重視」と明文化 | ✅ 対応済み (v1.3) |
| T14 | 🟡 Major | deleteItem の pendingDeleteIds 連携が未設計 | `deleteItem` は `updatedAt` 更新せず、`subscribe` での削除検知ロジックが未記載 | §4-6 shoppingStore 改修 | snapshot 差分で消えた id を `pendingDeleteIds` に追加するアルゴリズム擬似コードを追記 | ✅ 対応済み (v1.3) |
| T15 | 🟢 Minor | GDPR / アカウント削除フロー未言及 | Cascade 定義はあるが UI なし | §4-12 | Phase 9.1 のタスクとして明示記録 | ✅ 対応済み (v1.3) |
| T16 | 🟢 Minor | レート制限未言及 | 認証済みでも連射可能 | §4-5 共通エラーコード | Vercel Edge IP 制限 or Upstash の選択肢を §7 に追記 | ✅ 対応済み (v1.3) |
| T17 | 🟢 Minor | `<dialog>` と iOS Safari 互換性 | `dialog::backdrop` と Tailwind `z-*` の干渉、命令的 API パターン | §4-8 | 実装メモに `dialogRef.showModal()` パターン明記 | ✅ 対応済み (v1.3) |
| T18 | 🟢 Minor | 監査ログ未言及 | 障害調査困難 | §7 注意事項 | Phase 9 は console.log + Vercel ログで代替、本格対応は将来 | ✅ 対応済み (v1.3) |
| T19 | 🟢 Minor | SyncStatusDot の statusLabel 定義漏れ | コード例で参照されているが定義例なし | §4-7 | `STATUS_LABEL: Record<SyncStatus, string>` の定義例を追記 | ✅ 対応済み (v1.3) |

## 次アクション

1. ✅ ユーザー承認得済み（Auth.js v5 採用 + OnboardingModal 二択追加）
2. ✅ T1-T19 全件反映完了（設計書 v1.3）
3. ユーザー最終承認 → 実装フェーズへ
