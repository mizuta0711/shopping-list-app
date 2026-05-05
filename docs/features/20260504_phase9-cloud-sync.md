# 機能設計書: 買い物リスト Phase 9 — アカウント登録 + クラウド同期

## メタ情報

| 項目 | 内容 |
|------|------|
| 全体ステータス | 🔵 設計中 |
| 変更の性質 | 新規追加 |
| 変更規模 | L（新機能・DB スキーマ・UX 変更すべて含む） |
| Stage 1（機能・画面設計）| ✅ 確定（v1.3: OnboardingModal 二択追加反映） |
| Stage 2（技術設計） | ✅ 確定（v1.4: 2回のレビューで指摘 34 件すべて反映） |
| 作成日 | 2026-05-04 |
| 最終更新 | 2026-05-04（v1.4） |

---

## 1. 概要

### 背景

[企画書 v0.3](../企画書.md) Phase 9。MVP は LocalStorage のみで端末ローカル保存だが、同じユーザーが複数端末（スマホ/タブレット）でアプリを使うケースに対応するため、**Google アカウントでログイン → サーバーにデータを保存 → 端末間同期** を可能にする。

MVP は意図的にログインなしで設計しており、長期間使ったユーザーが「他の端末でも見たい」と感じたタイミングで初めて利用するオプトイン機能とする位置づけ。

### 目的

- 任意で **Google アカウントによるログイン** を提供（必須ではない）
- ログイン中は **編集が即時にサーバーへ同期** される
- 別端末で同じアカウントにログインすると **同じリストが表示** される
- ログアウトすると **ローカル保存に戻る**（サーバーのデータは温存）
- **オフラインでも動作** する（オンライン復帰時に自動同期）

### 方針

| 観点 | 判断 |
|------|------|
| ログイン手段 | Google OAuth のみ（NextAuth 4 で実装、Phase 0 で削除した基盤を再導入） |
| セッション戦略 | Database セッション（NextAuth + Prisma adapter） |
| データの所有者 | サーバー側で `userId` で全アイテムを所有（Prisma に `User` ↔ `ShoppingItem` のリレーション） |
| ID 生成 | クライアント側で `crypto.randomUUID()`（UUID v4）。Prisma スキーマも `@default(uuid())` で揃える |
| 同期方式 | **楽観的更新 + 最終書き込み勝ち（Last Write Wins, LWW）** を `updatedAt` ベースで判定 |
| 削除の同期 | MVP は **hard delete**。削除イベントは「`updatedAt` 更新 + 配列から除去」で送信。受信側は同期取得時に「サーバーに無い ID は削除されたものとして扱う」。tombstone 方式は Phase 9.1 として将来検討 |
| 編集の反映 | クライアント側で即時にローカル状態を更新、debounce（例: 1.5秒）してまとめてサーバーへ PUT |
| オフライン挙動 | LocalStorage の persist 経由で全編集が永続化される（既存挙動）。同期サービスはネットワーク復帰時に「最新のローカル全件 + 最終同期時刻以降のサーバー差分」で双方向 reconcile（pull-driven）。専用のキュー管理層は持たない |
| 競合解決 | LWW を基本。**上書きが発生した場合は事後トーストで通知**（"別端末の更新で N 件が最新版に置き換わりました"） |
| ローカルデータの取り扱い | 初回ログイン時、ローカル既存データを **サーバーへアップロード** してマージ。**サーバー側 API は session の userId で厳格にフィルタ**し、別ユーザーのデータが混入しない |
| ログアウト時の挙動 | 確認ダイアログで「この端末のローカルデータも削除する」のチェックボックス（デフォルト OFF）。ON ならローカルもクリア、OFF なら次回ログインまで端末に残す |
| ヘッダーアイコン配置 | 既存の RefreshCw / SortMenu / History / Settings に**追加せず**、SortMenu のドロップダウンに「同期状態」エントリを統合する。または title 横の小さなドット表示で対応（375px の制約を踏まえた設計） |
| オンボーディング文言 | Phase 9 適用時に `OnboardingModal` の警告文言を更新（「ログインすれば複数端末で同期できます」を追記）。さらに**最終ステップに「Google でログイン」/「ログインせず使う」の二択ボタンを追加**し、初回起動時にユーザーが明示的に選択できるようにする（既存 `hasOnboarded` フラグで管理） |
| プライバシー | サーバー保存は OAuth ログイン後のみ。匿名利用者のデータは一切送信しない |
| QR/URL 共有 | **非対応**。Phase 9 は「同一ユーザーの端末間同期」に絞る。家族共有や匿名共有は別フェーズ（将来検討）として切り出す |
| 優先度根拠 | 仮説段階の機能。MVP リリース後の利用ログを見て、複数端末利用ニーズが確認できた時点で着手判断する |

---

## 2. タスク一覧

| # | フェーズ | タスク | ステータス | 備考 |
|---|---------|--------|-----------|------|
| 1 | Stage 1 | 機能・画面設計記入 | ✅ 完了 | |
| 2 | Stage 1 | /design-review feature | ✅ 完了 | 条件付き承認、全 17 件の指摘を反映 |
| 3 | Stage 2 | 技術設計記入 | ✅ 完了（v1.4: T1-T19 + N1-N15 計 34 件反映） | Auth.js v5、`DeletionTombstone`、API ラッパー、DTO 型保護、useLocalStorage 仕様、syncOrchestrator factory 化など |
| 4 | Stage 2 | /design-review tech | ✅ 2回実施完了（指摘 34 件反映済み）。ユーザー目視承認待ち | 1回目: `docs/reviews/20260504_141824_design-review-tech-phase9.md`、2回目: `docs/reviews/20260504_144219_design-review-tech-phase9-2nd.md` |
| 5 | Phase 9 | NextAuth + Prisma 再導入 | ✅ 完了 | Auth.js v5 (next-auth@beta) + @auth/prisma-adapter + zod 追加。`src/lib/auth.ts` / `[...nextauth]/route.ts` / SessionProvider / Session 型拡張 |
| 6 | Phase 9 | DB スキーマ追加 + マイグレーション | ✅ 完了 | 6 テーブル (User/Account/Session/VerificationToken/ShoppingItem/DeletionTombstone)。`init-phase9-cloud-sync` マイグレーション適用、テーブル定義書自動生成 |
| 7 | Phase 9 | サーバー同期 API 実装 | ✅ 完了 | GET/PUT `/api/sync/items` + POST `/api/sync/merge`。Zod `.strict()`, LWW, DeletionTombstone upsert, ShoppingItemDTO で userId 漏洩防止。コードレビュー対応で merge stale read 修正 |
| 8 | Phase 9 | クライアント側の同期サービス実装 | ✅ 完了 | syncStore / reconcile / syncClient / syncOrchestrator (factory + subscribe + debounce 1.5s + online/focus + HMR) / useLocalStorage / useSyncStatus / useSyncOnMount / SyncProvider。shoppingStore に setItems / applyServerChanges 追加。layout.tsx に SyncProvider を SessionProvider 配下に追加 |
| 9 | Phase 9 | ログイン/ログアウト UI | ✅ 完了 | `/login` ページ + `AccountSection` (設定画面) + `ConfirmDialog`（汎用 dialog + checkbox）。SettingsView にデータ説明文追加 |
| 10 | Phase 9 | 同期状態インジケーター | ✅ 完了 | `SyncStatusDot` (ShoppingCart 右上) + `SyncStatusSheet` (最終同期 + エラー詳細 + 手動同期)。SyncProvider を Context 化して orchestrator を配信 |
| 11 | Phase 9 | 初回ログイン時のローカル→サーバー移行 | ✅ 完了 | `useInitialMerge` フック (hasMerged フラグで分岐: マージ済 → pullOnce / 未マージ → orchestrator.merge)。OnboardingModal を二択ボタン式に書き換え |
| 12 | Phase 9 | ビルド・型・lint・E2E | 🔵 未実施 | |
| 13 | Phase 9 | ブラウザ動作確認（複数端末シナリオ） | 🔵 未実施 | |

---

## 3. 機能・画面設計（Stage 1）

### 3-1. 対象画面と操作フロー

| 画面 | URL | 新規/変更 | 概要 |
|------|-----|----------|------|
| ログイン画面 | `/login` | 新規 | Google サインインボタン + 説明文 |
| 設定画面 | `/settings` | 変更 | 「アカウント」セクション追加（ログイン状態表示 / ログイン・ログアウトボタン） |
| メイン画面 | `/` | 変更 | ヘッダー右上に同期状態インジケーター（小さなアイコン）を追加 |
| 履歴画面 | `/history` | 変更 | 同期状態インジケーターを共通ヘッダーに追加（任意） |

#### 主要操作フロー

**0. 初回起動 → オンボーディング → 利用方法選択**

1. ユーザーが初めてアプリにアクセス（`hasOnboarded === false`）
2. メイン画面が背景に表示された状態で `OnboardingModal` が開く
3. 既存の使い方説明ステップを表示（今日買う/また今度買う、購入チェックで履歴へ等）
4. **最終ステップで「この端末だけで使うか / Google で同期するか」の二択を表示**
5. 「Google でログイン」をタップ → `/login` へ遷移し、フロー A に合流
6. 「ログインせず使う」をタップ → モーダルを閉じて `hasOnboarded = true` をセット → メイン画面で通常利用開始
7. いずれを選んでも、後から設定画面で切り替え可能（ローカル運用 ↔ ログイン）

**A. 初回ログイン（既存ローカルデータあり）**

1. ユーザーが設定画面の「Google でログイン」をタップ
2. NextAuth の OAuth フロー → Google 同意画面 → コールバック
3. ログイン成功後、設定画面に戻る
4. クライアントが LocalStorage の現在のデータをサーバーに POST（マージリクエスト）。サーバーは session の `userId` で厳格にフィルタしてマージする
5. サーバーは `userId` 配下の既存データと `updatedAt` で突き合わせ、最終的な集合を返す
6. クライアントはサーバーの集合で状態を上書き
7. **マージ結果のサマリーをトーストで通知**（例: 「ローカルから5件をサーバーへ送信、サーバーから2件取得しました」）
8. 以降、編集ごとに自動同期

**B. 既ログイン端末で編集**

1. 通常通り追加・購入チェック・並び替え等を行う
2. ストアの変更が起きるたびに、debounce（1.5秒）後に変更分をサーバーへ PUT
3. 同期成功でヘッダーのインジケーターが「同期済み（緑）」、失敗で「再試行中（黄）」を表示
4. 受信したサーバーレスポンスにより**ローカルが上書きされたアイテムがあれば事後トーストを表示**（"別端末の更新で N 件が最新版に置き換わりました"）

**C. 別端末でログイン**

1. 同じ Google アカウントでログイン
2. ログイン直後にサーバーから全件 GET → ローカル状態を上書き
3. 以降は B と同じ

**D. ログアウト**

1. 設定画面の「ログアウト」をタップ → 確認ダイアログ
2. ダイアログには「**この端末のローカルデータも削除する**」チェックボックス（デフォルト OFF）
3. ON: ローカルストアを `reset()` してログアウト → メイン画面は空状態 + オンボーディング文言から「ログインすれば〜」が再表示
4. OFF: NextAuth の signOut のみ実行 → ローカルデータはキャッシュとして残る
5. いずれの場合も「サーバーデータは引き続きアカウントに紐づいて保管されます。次回ログイン時に同じリストが表示されます」を完了トーストで表示
6. OFF を選んだ場合、ログアウト後の編集は再びローカル only として動作（次回ログインで再度マージ）

**E. オフライン編集**

1. ネットワーク断時、ヘッダーは「オフライン（灰）」アイコンを表示
2. 編集はローカル即時反映（既存の persist 経由で LocalStorage に保存される）
3. オンライン復帰検知 `window.addEventListener('online', ...)` → 同期サービスが「最新ローカル全件 + 最終同期時刻以降のサーバー差分」で双方向 reconcile を実行

### 3-2. 受け入れ条件（ユーザー目線）

- [ ] ログインなしで使い続けられる（既存 MVP 体験を完全に維持）
- [ ] **初回起動時、オンボーディングの最終ステップに「Google でログイン」「ログインせず使う」の二択ボタンが表示される**
- [ ] **「ログインせず使う」を選んだ場合、モーダルが閉じてメイン画面で通常利用できる。後から設定画面でログイン可**
- [ ] 「Google でログイン」をタップ → 数秒で完了し、メイン画面のリストはそのまま
- [ ] ログイン直後に既存ローカルデータがサーバーに保存されており、別端末でログインしても見える
- [ ] **ログイン直後にマージサマリーがトースト表示される**（X件送信 / Y件取得）
- [ ] アイテムを追加すると、別端末側でも数秒以内に表示される（手動リロード後でも可）
- [ ] **同期で別端末の更新による上書きが発生した場合、事後トーストで通知される**
- [ ] ヘッダーに同期状態が一目で分かるインジケーターがある（同期済み/同期中/オフライン/エラー）。レイアウトは既存アイコン群を圧迫しない配置（SortMenu 統合 or タイトル横ドット）
- [ ] オフラインでも追加・チェックが可能で、復帰時に自動で送信される
- [ ] ログアウト時、確認ダイアログで「ローカルデータも削除する」を任意で選択できる
- [ ] ログアウトしても次回ログインで同じリストが復元される（サーバーデータは温存）
- [ ] 設定画面でアカウント情報（メール）が確認できる
- [ ] 設定画面のデータセクションに「クラウド同期中はエクスポートはバックアップ用途」など説明文が表示される

### 3-3. 画面レイアウト

#### ログイン画面 `/login`

戻るボタンは `router.back()` で履歴に戻る。履歴がない場合は `/` にフォールバック。
（NextAuth コールバック後に直接 `/login` を再表示するケースを想定）

```
┌─────────────────────────────┐
│ ← 戻る                       │
├─────────────────────────────┤
│                             │
│           🛒                │
│                             │
│   ログイン                   │
│                             │
│   ログインすると、複数の       │
│   端末でリストを共有できます    │
│                             │
│  ┌───────────────────────┐  │
│  │ G  Google でログイン   │  │
│  └───────────────────────┘  │
│                             │
│   後で（ログインなしで使う）   │
│                             │
└─────────────────────────────┘
```

#### 設定画面（変更後）

```
┌─────────────────────────────┐
│ ← 設定                       │
├─────────────────────────────┤
│ アカウント                    │  ← 新セクション
│ ┌──────────────────────┐    │
│ │ 👤 user@example.com  │    │  ← ログイン中
│ │    最終同期: 5分前     │    │
│ └──────────────────────┘    │
│ ┌──────────────────────┐    │
│ │ ログアウト            │    │
│ └──────────────────────┘    │
│                             │
│ ── または ──                │
│                             │
│ （未ログイン時の表示例）       │
│ ┌──────────────────────┐    │
│ │ G  Google でログイン  │    │
│ │   端末間でリスト同期    │    │
│ └──────────────────────┘    │
│                             │
│ データ                       │  ← 既存セクション
│ ┌──────────────────────┐    │
│ │ JSON でエクスポート    │    │
│ └──────────────────────┘    │
│ ...                         │
```

#### メイン画面ヘッダー（変更後）

ヘッダーアイコンの過密を避けるため、**新たな単独アイコンは追加せず**、以下のいずれかで対応する（Stage 2 で確定）:

**案 A: タイトル左の小さなドット**

```
┌─────────────────────────────┐
│ 🛒 ● 買い物リスト  🔄 ↕ 🕘 ⚙ │
└─────────────────────────────┘
```

`🛒` の右に色付きの小さなドット（緑 = 同期済み / 黄 = 同期中 / 灰 = オフライン / 赤 = エラー）。タップ可。

**案 B: SortMenu のドロップダウン内に統合**

SortMenu を開くと、上部に「同期: 同期済み」というステータス行が表示される。

| 状態 | 色 | 意味 |
|---|---|---|
| 同期済み | 緑 | 直近の編集が全てサーバー反映済み |
| 同期中 | 黄 | 送信中・進行中 |
| オフライン | 灰 | オフライン中、復帰待ち |
| エラー | 赤 | 同期失敗（タップで再試行） |
| 未ログイン | 非表示 | ログインしていない場合は表示しない |

→ Stage 2 で実機検証して案 A or B を確定する。

#### OnboardingModal（変更後）

既存の使い方説明ステップは維持し、**最終ステップを「利用方法選択」に差し替える**。

```
┌─────────────────────────────┐
│  使い方の説明（既存ステップ）   │
│  ・今日買う / また今度買う      │
│  ・購入チェックで履歴へ        │
│  ・並び替えはドラッグで         │
│  ...                         │
├─────────────────────────────┤
│  最終ステップ（新規）           │
│                             │
│  この端末だけで使いますか？      │
│  別の端末でも使う場合は、        │
│  Google アカウントで同期できます │
│                             │
│  ┌───────────────────────┐  │
│  │ G  Google でログイン   │  │ ← /login へ遷移、フロー A に合流
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ログインせず使う       │  │ ← モーダルを閉じてメイン画面へ
│  └───────────────────────┘  │
│                             │
│  ※ 後から設定でログインできます  │
└─────────────────────────────┘
```

**動作仕様**:
- いずれのボタンも `hasOnboarded = true` をセット → 次回以降このモーダルは出ない
- 「Google でログイン」: `router.push('/login')` で遷移。`/login` 側で「後で」を選べば未ログインのままメインへ戻れる
- 「ログインせず使う」: モーダルを閉じるのみ。**サーバー通信は一切発生しない**
- `<dialog>` のクローズ操作（背景タップ・ESC）は**無効化**（明示選択を促すため）

### 3-4. エラー・例外シナリオ

| シナリオ | アプリの挙動 |
|---|---|
| OAuth 認可失敗 | ログイン画面に戻り「ログインに失敗しました」を表示 |
| サーバー API 5xx | リトライ（指数バックオフ）、最大3回。失敗時はエラーアイコン |
| ローカルとサーバーで `id` 衝突 | `updatedAt` 新しい方を採用（LWW） |
| クライアント側のクロックずれ | サーバー側のタイムスタンプを優先採用（受信レスポンスで `updatedAt` 上書き） |
| 同期中にユーザーがログアウト | キューを破棄して signOut 完了 |
| 複数端末で同時編集 | LWW により最終書き込みが勝つ。MVP では UI で警告しない |

### 3-5. Stage 1 レビュー記録

| 日付 | レビューファイル | 判定 | 対応 |
|------|-----------------|------|------|
| 2026-05-04 | `docs/reviews/20260504_054415_design-review-feature-phase9.md` | ⚠️ 条件付き承認 | 全 17 件（C1-C9, P1-P8）の指摘を設計書本体に反映済み。Stage 2 で技術詳細を確定する |

---

## 4. 技術設計（Stage 2）

### 4-0. ライブラリ選定と Stage 1 方針の見直し

| 項目 | Stage 1 方針 | Stage 2 採用 | 理由 |
|------|------------|------------|------|
| 認証ライブラリ | NextAuth 4 | **Auth.js v5 (`next-auth@beta`、現在 5.0.0-beta.31)** ※Stage 1 から変更（ユーザー承認済み） | Next.js 16 + React 19 + App Router の組み合わせは Auth.js v5 系が公式の対応形。NextAuth 4 は Pages Router 中心で App Router サポートが限定的 |
| Prisma adapter | （未指定）| `@auth/prisma-adapter@^2`（GA、v5 系専用） | Auth.js v5 に追従 |
| バリデーション | （未指定）| `zod@^3`（新規追加） | API 設計書の標準 |

**Auth.js v5 beta の採用判断**: v5 は名目上 beta だが、2023 年から長期間 beta タグで運用されており、Vercel と Authjs.dev 公式は v5 を推奨。Next.js App Router の最新パターン (`auth()` ヘルパー、`handlers` 分割代入、`session` callback での DB session 戦略) はすべて v5 系のみ。ユーザー承認のもと「実質的に安定版」として採用する。`package.json` には `next-auth@beta` 表記で固定する。

追加 npm パッケージ（提案）:
```
next-auth@^5
@auth/prisma-adapter@^2
zod@^3
```

### 4-1. DB スキーマ

`prisma/schema.prisma` に以下を追加。

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// ユーザー（Google OAuth で作成される）
model User {
  id            String          @id @default(uuid())
  name          String?
  email         String          @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  accounts      Account[]
  sessions      Session[]
  shoppingItems ShoppingItem[]
  tombstones    DeletionTombstone[]
}

/// OAuth プロバイダのアカウント情報（Auth.js 標準）
model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String  /// "oauth" など
  provider          String  /// "google"
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

/// データベースセッション（Auth.js 標準）
model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

/// メール検証トークン（Auth.js 標準。Google OAuth のみなら未使用だが将来拡張のため定義）
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

/// 買い物アイテム（クラウド同期対象）
model ShoppingItem {
  id          String    @id  /// クライアント発行 UUID v4
  userId      String    /// 所有ユーザー
  name        String    /// アイテム名
  scope       String    /// "TODAY" | "LATER"
  status      String    /// "PENDING" | "PURCHASED"
  order       Int       /// 同一 scope 内の表示順
  createdAt   DateTime  /// クライアント発行のタイムスタンプ
  updatedAt   DateTime  /// LWW 判定キー
  purchasedAt DateTime? /// PURCHASED に遷移した時刻

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, updatedAt])
  @@index([userId, scope, status])
}

/// 削除イベントのトラッキング（since 以降の削除を別端末に伝播するため）
/// hard delete 時にここに行を追加する。一定期間（例: 30日）経過後にバッチで掃除する想定（Phase 9.1）
model DeletionTombstone {
  id        String   @id @default(uuid())
  userId    String   /// 削除を行ったユーザー
  itemId    String   /// 削除された ShoppingItem の id
  deletedAt DateTime @default(now()) /// サーバー時刻

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, deletedAt])
  @@unique([userId, itemId])
}
```

**設計判断**:
- `id` は `@default(uuid())` を使わず**クライアント発行**を必須化（オフライン編集と楽観的更新で衝突を避けるため）
- `updatedAt` は `@updatedAt` を使わず**クライアント発行値を保存**（LWW 判定の主キー）。サーバー側でのみ更新する設計だとオフライン編集の順序が狂う
- `scope` / `status` は Prisma の Enum を使わず String にする（クライアント側の types.ts と単純な文字列で揃える）
- `User` 削除時に `ShoppingItem` を Cascade 削除（アカウント削除フローは Phase 9 では実装しないが定義しておく）
- インデックス: `[userId, updatedAt]` が差分取得の主クエリ、`[userId, scope, status]` が一覧取得用

**マイグレーション**:
```bash
npx prisma migrate dev --name add-user-and-shopping-item
```

DB バックアップ手順は CLAUDE.md の §「DB スキーマ変更時の必須ルール」に従う:
1. 変更**前に** `npx tsx tools/export-to-sql.ts` を実行（既存の MVP では DB 未使用なので空エクスポート）
2. `tools/export-to-sql.ts` の `ORDERED_TABLES` / `DB_TABLE_MAP` に新テーブルを追加
3. `tools/scripts/generate-table-docs.ts` を実行してテーブル定義書を再生成

### 4-2. 環境変数

`.env.example`（コミット対象、ダミー値 + 日本語コメント付き）と `.env.local`（コミットしない、実値）の2ファイルで管理する。

`.env.example` の内容（実ファイルとして既に作成済み）:

| キー | 用途 | 取得方法 |
|------|------|---------|
| `DATABASE_URL` | PostgreSQL 接続文字列。**`?connection_limit=5&pool_timeout=10` を必ず付与**（Vercel + Neon 無料枠の接続上限 10 を考慮、T11 対応） | Neon / Supabase ダッシュボードからコピー |
| `AUTH_SECRET` | Auth.js セッション暗号化キー（base64 32 bytes） | `openssl rand -base64 32` |
| `AUTH_URL` | アプリ公開 URL。Vercel デプロイ時は自動設定 | 開発 `http://localhost:3000` / 本番は環境のドメイン |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | Google Cloud Console → 認証情報 → OAuth クライアント ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | 同上 |

実ファイル: `/workspaces/shopping-list-app/.env.example` を参照。

**運用フロー**:
1. 開発者は `cp .env.example .env.local` を実行
2. 各値を実値に書き換える
3. `.env.local` は `.gitignore` 済みでコミットされない
4. Vercel デプロイ時は環境変数を Project Settings から登録

### 4-3. NextAuth（Auth.js v5）設定

`src/lib/auth.ts`（新規）:

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: { ...session.user, id: user.id },
    }),
  },
  pages: { signIn: "/login" },
});
```

`src/app/api/auth/[...nextauth]/route.ts`（新規）:
```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

※ `src/lib/auth.ts` の `NextAuth({ ... })` 戻り値分割代入で `handlers` を named export しているため、route.ts はそこから直接 import する。Auth.js v5 公式パターン。

型拡張 `src/types/next-auth.d.ts`（新規）:
```ts
import "next-auth";
declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
```

ミドルウェア（必要時のみ追加）: 同期 API は各 route.ts 内で `auth()` を呼んで `session.user.id` をチェックする方針とし、`middleware.ts` は今フェーズでは追加しない（パフォーマンスと挙動把握のしやすさを優先）。

#### API ラッパー方針

`.claude/01_development_docs/04_error_handling_design.md` で構想された `withAuth()` / `withPublic()` ラッパー（`src/lib/api/`）は **Phase 9 では実装しない**。理由:
- 現状未実装で、Phase 9 のスコープに対して導入コストに見合わない
- sync API は3エンドポイントのみで、各 route.ts に共通ヘルパーを直接書くほうが見通しがよい

代わりに以下の小さなヘルパーを `src/lib/api/sync-helpers.ts` として用意し、3つの sync route.ts で共有する:

```ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { ApiError } from "@/types/sync";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json<ApiError>(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      ),
    };
  }
  return { userId: session.user.id };
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return NextResponse.json<ApiError>(
    { success: false, error: { code: "INVALID_INPUT", message, fields } },
    { status: 400 }
  );
}

export function internalError() {
  return NextResponse.json<ApiError>(
    { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラー" } },
    { status: 500 }
  );
}
```

`withAuth()` の本格導入は `src/lib/api/` ディレクトリ整備と合わせて将来フェーズで検討する（`docs/設計書/.doc-sync.md` に課題として記録）。

### 4-4. 共有型定義

`src/types/sync.ts`（新規。BE/FE 双方が import）:

```ts
import type { ShoppingItem } from "@/features/shopping/types";

/**
 * クライアント送受信に使う ShoppingItem DTO。
 * Prisma モデル（`userId` を含む）から `userId` を除外した形で定義する。
 *
 * - FE 側の `ShoppingItem` には元々 `userId` がないため、`Omit` 自体は実質 no-op だが、
 *   将来 `ShoppingItem` に `userId` が追加された場合でも DTO に漏れないことを型レベルで保証する。
 * - サーバー側で受信した `upserts` には必ず `{ ...input, userId: session.user.id }` で
 *   `userId` を上書きしてから Prisma に渡す（クライアントが偽装した userId を弾く防御層）。
 */
export type ShoppingItemDTO = Omit<ShoppingItem, "userId">;

/** API 共通レスポンス */
export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = {
  success: false;
  error: { code: string; message: string; fields?: Record<string, string> };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** GET /api/sync/items のレスポンス data */
export type SyncPullResponse = {
  items: ShoppingItemDTO[];        // since 指定時は updatedAt > since の差分のみ。未指定時は全件
  serverDeletes: string[];          // since 以降に削除された id 一覧（since 未指定時は []）
  serverTime: string;               // ISO 8601。クロックずれ補正計測に使用
  lastUpdatedAt: string | null;     // 最大 updatedAt（次回 since 引数に使う）
};

/** PUT /api/sync/items のリクエスト */
export type SyncPushRequest = {
  upserts: ShoppingItemDTO[];   // ローカルで追加・変更されたアイテム（userId は含めない、サーバー側で付与）
  deletedIds: string[];         // ローカルで削除された ID
  since: string | null;         // 最終同期成功時の lastUpdatedAt
};

/** PUT /api/sync/items のレスポンス data */
export type SyncPushResponse = {
  applied: ShoppingItemDTO[];      // 実際に DB に書き込まれた最新アイテム（userId 除外）
  rejected: Array<{                // LWW で上書きされなかったもの
    id: string;
    reason: "SERVER_NEWER";
    serverItem: ShoppingItemDTO;   // クライアントが採用すべき最新版
  }>;
  serverChanges: ShoppingItemDTO[]; // since 以降に他端末から書き込まれた差分
  serverDeletes: string[];          // since 以降に他端末から削除された ID
  serverTime: string;
  lastUpdatedAt: string | null;
};

/** POST /api/sync/merge のリクエスト（初回ログイン時のローカル全件アップロード） */
export type SyncMergeRequest = {
  localItems: ShoppingItemDTO[];
};

/** POST /api/sync/merge のレスポンス data */
export type SyncMergeResponse = {
  finalItems: ShoppingItemDTO[];  // マージ後の全件（userId 除外）
  uploadedCount: number;           // ローカル → サーバー新規追加された件数
  downloadedCount: number;         // サーバー → クライアントに追加された件数
  serverTime: string;
  lastUpdatedAt: string | null;
};
```

### 4-5. API 設計

`docs/設計書/API一覧.md` への追記対象。共通仕様は同ファイルの先頭ルール（`{success, data?, error?}` 形式、Zod バリデーション）に従う。

**API パスバージョニング方針**: `.claude/01_development_docs/03_api_design.md` に `/api/v1/...` の構想があるが、Phase 9 時点ではプロジェクト全体で `v1` プレフィクスを採用していない（現状 API 0 件）。**Phase 9 では `v1` プレフィクスなしで `/api/sync/items` 形式を採用**し、将来 v2 が必要になった時点でリダイレクト + 全 API への `/v1/` 一括導入を検討する。`03_api_design.md` の該当箇所もこの方針に揃えて更新する（`/update-docs` で対応）。

#### 共通エラーコード

| code | HTTP | 意味 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 未ログイン or セッション失効 |
| `INVALID_INPUT` | 400 | Zod バリデーションエラー |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー（リトライ対象） |

#### `GET /api/sync/items`

別端末ログイン直後の全件取得、または通常時の差分取得に使用。

**クエリパラメータ**:
- `since` (string, optional): ISO 8601。指定された場合は `updatedAt > since` のアイテムのみ返す

**Zod スキーマ**:
```ts
const SyncPullQuerySchema = z.object({
  since: z.string().datetime().optional(),
});
```

`?since=null` や空文字、不正な日時文字列を受信した場合は 400 / `INVALID_INPUT` を返す（Zod の datetime バリデーションで自動拒否）。

**リクエスト例**:
```
GET /api/sync/items?since=2026-05-04T10:00:00.000Z
```

**レスポンス例（200）**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "0a3e8c2b-aaaa-4bbb-8ccc-111111111111",
        "name": "牛乳",
        "scope": "TODAY",
        "status": "PENDING",
        "order": 0,
        "createdAt": "2026-05-04T09:50:00.000Z",
        "updatedAt": "2026-05-04T10:05:00.000Z",
        "purchasedAt": null
      }
    ],
    "serverDeletes": ["c3d4e5f6-bbbb-4ccc-8ddd-222222222222"],
    "serverTime": "2026-05-04T10:30:00.123Z",
    "lastUpdatedAt": "2026-05-04T10:05:00.000Z"
  }
}
```

**実装メモ**:
- `since` 省略時は全件返し、`serverDeletes` は `[]` を返す
- `since` 指定時は `updatedAt > since` の生存アイテムを `items` に、別途トラッキングテーブルから削除 id を `serverDeletes` に詰める
- `serverDeletes` を実装するため、Prisma に `DeletionTombstone` モデルを追加する（§4-1 補足参照）

#### `PUT /api/sync/items`

クライアントが debounce 後にローカル変更をまとめて送信する主エンドポイント。サーバーは LWW 判定を行い、上書きされた項目と他端末からの差分を返す。

**リクエスト Zod スキーマ（抜粋）**:
```ts
// userId は意図的にスキーマから除外する。
// クライアントが userId を payload に混入させても strict() で弾かれる。
// サーバー側 upsert 時は { ...input, userId: session.user.id } で必ず上書きする。
const ShoppingItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  scope: z.enum(["TODAY", "LATER"]),
  status: z.enum(["PENDING", "PURCHASED"]),
  order: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  purchasedAt: z.string().datetime().nullable(),
}).strict(); // ★ 余分なフィールド（userId 等）を含む payload は 400 で拒否

const SyncPushSchema = z.object({
  upserts: z.array(ShoppingItemSchema).max(500),
  deletedIds: z.array(z.string().uuid()).max(500),
  since: z.string().datetime().nullable(),
}).strict();
```

**リクエスト例**:
```json
{
  "upserts": [
    { "id": "0a3e8c2b-...", "name": "牛乳", "scope": "TODAY", "status": "PURCHASED",
      "order": 0, "createdAt": "2026-05-04T09:50:00.000Z",
      "updatedAt": "2026-05-04T10:35:12.000Z", "purchasedAt": "2026-05-04T10:35:12.000Z" }
  ],
  "deletedIds": ["b1d2..."],
  "since": "2026-05-04T10:00:00.000Z"
}
```

**サーバー処理**:
1. `auth()` で `userId` 取得。未ログインなら 401
2. Zod バリデーション → 400 / `INVALID_INPUT`
3. トランザクション内で:
   - `upserts` を1件ずつ判定:
     - 既存レコードが存在し `existing.updatedAt >= input.updatedAt` の場合 → **スキップして `rejected` に積む**（同値時もサーバー側を正とする。冪等性重視。LWW の同点判定）
     - それ以外は upsert 実行。`WHERE id = input.id AND userId = session.user.id` で所有権を保証
   - `deletedIds` の処理: `WHERE userId = session.user.id AND id IN (deletedIds)` のレコードを削除（所有権チェックはこの WHERE 句で完結。別ユーザーの id を混ぜられても影響なし）。**削除と同時に各 id に対して `DeletionTombstone.upsert({ where: { userId_itemId: { userId, itemId: id } }, create: { userId, itemId: id }, update: { deletedAt: new Date() } })` を実行**（同一 id の削除→再作成→再削除でも `@@unique([userId, itemId])` 違反にならず、最新の deletedAt で上書きされる）
   - 他端末差分の取得:
     - `serverChanges`: `userId = session.user.id AND updatedAt > since AND id NOT IN (input.upsert.ids ∪ input.deletedIds)`
     - `serverDeletes`: `DeletionTombstone WHERE userId = session.user.id AND deletedAt > since AND itemId NOT IN (input.deletedIds)`
4. レスポンス組み立て

**レスポンス例（200）**:
```json
{
  "success": true,
  "data": {
    "applied": [
      {
        "id": "0a3e8c2b-aaaa-4bbb-8ccc-111111111111",
        "name": "牛乳",
        "scope": "TODAY",
        "status": "PURCHASED",
        "order": 0,
        "createdAt": "2026-05-04T09:50:00.000Z",
        "updatedAt": "2026-05-04T10:35:12.000Z",
        "purchasedAt": "2026-05-04T10:35:12.000Z"
      }
    ],
    "rejected": [
      {
        "id": "b1d2c3e4-aaaa-4bbb-8ccc-333333333333",
        "reason": "SERVER_NEWER",
        "serverItem": {
          "id": "b1d2c3e4-aaaa-4bbb-8ccc-333333333333",
          "name": "卵 (10個入)",
          "scope": "TODAY",
          "status": "PENDING",
          "order": 1,
          "createdAt": "2026-05-04T09:55:00.000Z",
          "updatedAt": "2026-05-04T10:36:00.000Z",
          "purchasedAt": null
        }
      }
    ],
    "serverChanges": [
      {
        "id": "e7f8g9h0-aaaa-4bbb-8ccc-444444444444",
        "name": "パン",
        "scope": "LATER",
        "status": "PENDING",
        "order": 0,
        "createdAt": "2026-05-04T10:20:00.000Z",
        "updatedAt": "2026-05-04T10:25:00.000Z",
        "purchasedAt": null
      }
    ],
    "serverDeletes": ["dead0001-aaaa-4bbb-8ccc-555555555555"],
    "serverTime": "2026-05-04T10:36:01.456Z",
    "lastUpdatedAt": "2026-05-04T10:36:00.000Z"
  }
}
```

**設計判断**:
- 削除は MVP は hard delete。削除は `DeletionTombstone` テーブルでトラッキングし、GET / PUT 双方のレスポンスで `serverDeletes` として返す（T7 対応）
- 別端末の削除を検知できるトリガー: 自分が PUT したとき、online 復帰時 / windowFocus 時の GET、ログイン直後の GET
- max 500 件は安全弁。MVP のリスト規模では超えない想定
- **`since: null` の扱い**: `since: null` を受信した場合、サーバーは `serverChanges = []`、`serverDeletes = []` を返す（差分が「全件」になり大量データが返るのを防ぐ）。クライアントは初回 PUT 前に必ず GET を呼んで `lastUpdatedAt` を取得し、それ以降の PUT では取得済みの値を `since` に詰める。`useSyncOnMount` フックがこの初期化を担う

#### `POST /api/sync/merge`

初回ログイン時にローカル既存データをサーバーにマージするための専用エンドポイント。`PUT /api/sync/items` でも代用できるが、`uploadedCount` / `downloadedCount` を明示的に返してトーストに使うため分離する。

**Zod スキーマ**:
```ts
// PUT と同じ ShoppingItemSchema を再利用（strict() 含む）
const SyncMergeSchema = z.object({
  localItems: z.array(ShoppingItemSchema).max(500),
}).strict();
```

**リクエスト例**:
```json
{
  "localItems": [
    {
      "id": "0a3e8c2b-aaaa-4bbb-8ccc-111111111111",
      "name": "牛乳",
      "scope": "TODAY",
      "status": "PENDING",
      "order": 0,
      "createdAt": "2026-05-04T09:50:00.000Z",
      "updatedAt": "2026-05-04T09:50:00.000Z",
      "purchasedAt": null
    },
    {
      "id": "1b4f9d3c-aaaa-4bbb-8ccc-666666666666",
      "name": "パン",
      "scope": "LATER",
      "status": "PENDING",
      "order": 0,
      "createdAt": "2026-05-04T09:51:00.000Z",
      "updatedAt": "2026-05-04T09:51:00.000Z",
      "purchasedAt": null
    }
  ]
}
```

**サーバー処理**:
1. `auth()` で `userId` 取得（401 / `UNAUTHORIZED` なら早期 return）
2. Zod バリデーション → 失敗時 400 / `INVALID_INPUT`
3. トランザクション内で:
   - `localItems` を1件ずつ `{ ...input, userId }` で upsert（衝突時は LWW、`existing.updatedAt >= input.updatedAt` ならスキップ）
   - 全件取得して `finalItems` に詰める
4. `uploadedCount = localItems.filter(l => 既存に無かった).length`
5. `downloadedCount = finalItems.filter(f => localItems.id に無かった).length`
6. レスポンス組み立て

**レスポンス例（200）**:
```json
{
  "success": true,
  "data": {
    "finalItems": [
      {
        "id": "0a3e8c2b-aaaa-4bbb-8ccc-111111111111",
        "name": "牛乳",
        "scope": "TODAY",
        "status": "PENDING",
        "order": 0,
        "createdAt": "2026-05-04T09:50:00.000Z",
        "updatedAt": "2026-05-04T09:50:00.000Z",
        "purchasedAt": null
      },
      {
        "id": "1b4f9d3c-aaaa-4bbb-8ccc-666666666666",
        "name": "パン",
        "scope": "LATER",
        "status": "PENDING",
        "order": 0,
        "createdAt": "2026-05-04T09:51:00.000Z",
        "updatedAt": "2026-05-04T09:51:00.000Z",
        "purchasedAt": null
      },
      {
        "id": "9e1c7b5a-aaaa-4bbb-8ccc-777777777777",
        "name": "卵 (10個入)",
        "scope": "TODAY",
        "status": "PENDING",
        "order": 1,
        "createdAt": "2026-05-03T14:00:00.000Z",
        "updatedAt": "2026-05-03T14:00:00.000Z",
        "purchasedAt": null
      }
    ],
    "uploadedCount": 2,
    "downloadedCount": 1,
    "serverTime": "2026-05-04T10:40:00.789Z",
    "lastUpdatedAt": "2026-05-04T09:51:00.000Z"
  }
}
```

### 4-6. クライアント同期サービス

#### ディレクトリ構成

```
src/features/sync/
├── stores/
│   └── syncStore.ts          # 同期ステータス、最終同期時刻、エラー、保留中の変更
├── services/
│   ├── syncClient.ts          # fetch ラッパー（リトライ、エラーハンドリング）
│   ├── syncOrchestrator.ts    # debounce、reconcile、push/pull 統合
│   └── reconcile.ts           # LWW 判定とローカル状態への適用ロジック（純粋関数）
├── hooks/
│   ├── useSyncStatus.ts       # 同期状態の購読
│   └── useSyncOnMount.ts      # マウント時 + online 復帰時の pull
└── components/
    ├── SyncStatusDot.tsx      # ヘッダーのドット表示（案 A）
    └── LoginButton.tsx        # Google でログインボタン（設定画面 + /login で再利用）
```

`shoppingStore` 側に手を入れる箇所:
- `setItems(items: ShoppingItem[])` アクション追加（reconcile からの上書き用）
- `applyServerChanges({ upserts, deletes }: { upserts: ShoppingItem[]; deletes: string[] })` アクション追加
- 既存アクションは内部実装は変えず、`subscribe` でログインユーザーの操作を syncOrchestrator に渡す

**subscribe による差分検知（擬似コード）**: `deleteItem` は `updatedAt` を更新せず単に配列から除去するだけなので、syncOrchestrator 側で snapshot 比較して削除 id を検出する。

**factory 関数で内部状態をクロージャに閉じ込める**ことでモジュールスコープ汚染と HMR 二重購読を防ぐ。クライアント専用に明示する:

```ts
// src/features/sync/services/syncOrchestrator.ts
"use client"; // ファイル冒頭に明示してサーバー実行を防ぐ

export function createSyncOrchestrator() {
  // SSR ガード
  if (typeof window === "undefined") {
    return { start: () => {}, stop: () => {} };
  }

  let prevSnapshot = useShoppingStore.getState().items;
  let unsubscribe: (() => void) | null = null;

  const start = () => {
    if (unsubscribe) return; // 二重 start 防止
    unsubscribe = useShoppingStore.subscribe((state) => {
      const next = state.items;
      const prev = prevSnapshot;
      const prevById = new Map(prev.map(i => [i.id, i]));
      const nextById = new Map(next.map(i => [i.id, i]));

      // 追加 or 変更（updatedAt が変わったもの）
      for (const item of next) {
        const before = prevById.get(item.id);
        if (!before || before.updatedAt !== item.updatedAt) {
          useSyncStore.getState().markUpsert(item.id);
        }
      }
      // 削除（前 snapshot にあって新 snapshot にない）
      for (const item of prev) {
        if (!nextById.has(item.id)) {
          useSyncStore.getState().markDelete(item.id);
        }
      }

      prevSnapshot = next;
      scheduleDebouncedPush(); // 1.5s 後に PUT 発火
    });
  };

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
  };

  return { start, stop };
}
```

**起動と HMR 対応**: クライアントコンポーネント（例: `<SyncProvider>`）の `useEffect` 内でインスタンス化し、cleanup で `stop()` を呼ぶ:

```tsx
// src/components/providers/SyncProvider.tsx
"use client";
useEffect(() => {
  const orchestrator = createSyncOrchestrator();
  orchestrator.start();
  return () => orchestrator.stop(); // HMR 時に古い購読を確実に解除
}, []);
```

#### syncStore の状態

```ts
type SyncStatus = "idle" | "syncing" | "offline" | "error" | "logged_out";

type SyncState = {
  status: SyncStatus;
  lastSyncedAt: string | null;       // 最後に成功した PUT/GET の serverTime
  lastUpdatedAt: string | null;      // 次回 since として送る値
  pendingUpsertIds: Set<string>;     // debounce 中の対象
  pendingDeleteIds: Set<string>;
  errorMessage: string | null;
};
```

`lastUpdatedAt` のみ LocalStorage 永続化（再起動後の差分取得起点）。`pending*` はメモリのみで、ローカル全件と差分計算で再構築可能。

**Zustand persist 設定**:
```ts
persist(
  (set) => ({ ...initialState, ...actions }),
  {
    name: "sync-store",
    partialize: (s) => ({ lastUpdatedAt: s.lastUpdatedAt }),
    // pendingUpsertIds / pendingDeleteIds は Set 型のため JSON シリアライズ不可。
    // partialize で除外することで起動時に空 Set で再初期化される。
  }
)
```

#### 同期トリガー一覧

| トリガー | 動作 |
|---------|------|
| マウント時 + ログイン中 | `GET /api/sync/items?since=lastUpdatedAt` を1回実行 |
| `shoppingStore` 変更 (subscribe) | `pendingUpsertIds` / `pendingDeleteIds` を更新 → debounce 1.5s 後に `PUT /api/sync/items` |
| `window` の `online` イベント | `GET` で差分取得 → 続けて `PUT` で保留中を送信 |
| `window` の `focus` イベント | 60秒以上経過していれば `GET` で差分取得 |
| ユーザーがエラーアイコンをタップ | 即時リトライ |
| ログイン直後（マージフロー） | `POST /api/sync/merge` を1回実行 |

`shoppingStore.subscribe` は items 配列の差分を浅く比較し、id 単位で `pendingUpsertIds` / `pendingDeleteIds` を更新する純粋関数を介する。

#### クロックずれ補正の取り扱い

`updatedAt` は ISO 8601 文字列の辞書順比較で LWW 判定を行う。クロックずれ補正は**「発行時のみ」適用し、比較時には適用しない**:

- **発行時**（クライアントがアイテムを編集して `updatedAt` をセットするとき）: `new Date(Date.now() - clockSkewMs).toISOString()` を使う
- **比較時**（reconcile / サーバー LWW）: 受信した値をそのまま比較に使う（変換なし）

この方針により、クロックがずれた端末から発行された値もサーバー時刻ベースに揃い、他端末との比較が正しく機能する。`clockSkewMs` は `syncStore` で持ち、レスポンスの `serverTime` と `Date.now()` の差から都度更新する。

#### reconcile アルゴリズム

```ts
// reconcile.ts（擬似コード）
function reconcile(
  local: ShoppingItem[],
  serverChanges: ShoppingItem[],
  serverDeletes: string[],
  rejected: SyncPushResponse["rejected"],
): {
  next: ShoppingItem[];
  overwrittenCount: number;  // トースト用
} {
  const map = new Map(local.map(i => [i.id, i]));

  // 1. サーバーから受信した差分を LWW で適用
  for (const s of serverChanges) {
    const l = map.get(s.id);
    if (!l || l.updatedAt < s.updatedAt) map.set(s.id, s);
  }

  // 2. PUT で reject された分（サーバー側が新しかった）を採用
  let overwrittenCount = 0;
  for (const r of rejected) {
    map.set(r.id, r.serverItem);
    overwrittenCount++;
  }

  // 3. サーバー側の削除を反映
  for (const id of serverDeletes) map.delete(id);

  return { next: Array.from(map.values()), overwrittenCount };
}
```

#### リトライポリシー

- 5xx / ネットワークエラー: 指数バックオフ（1s, 2s, 4s）で最大3回
- 401: signOut() を呼び `status = "logged_out"` に遷移
- 400 / `INVALID_INPUT`: リトライしない（クライアントバグの可能性）。エラートーストでユーザーに通知し、開発者向けに console.error
- 全リトライ失敗時は `status = "error"`、ヘッダーの赤ドットをタップで再試行可

### 4-7. 同期インジケーター（案 A 確定）

ShoppingMainView のヘッダー、`<ShoppingCart>` アイコンの**右上**に、絶対配置の小さなドット（直径 8px）を重ねる。タップ時のヒット領域は ShoppingCart アイコン全体（h-9 w-9）に広げ、別端末同期サマリーの簡易ボタンとして機能させる。

```tsx
// ShoppingMainView.tsx の該当箇所（差分イメージ）
<button onClick={openSyncSheet} aria-label={`同期状態: ${statusLabel}`}>
  <ShoppingCart className="h-5 w-5 text-gray-900" aria-hidden />
  <SyncStatusDot status={syncStatus} />
</button>
```

`SyncStatusDot` の実装方針:
```tsx
const COLOR: Record<SyncStatus, string> = {
  idle: "bg-emerald-500",      // 同期済み
  syncing: "bg-amber-400",     // 同期中
  offline: "bg-gray-400",      // オフライン
  error: "bg-red-500",         // エラー
  logged_out: "hidden",         // 未ログイン時は非表示
};

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: "同期済み",
  syncing: "同期中",
  offline: "オフライン",
  error: "同期エラー",
  logged_out: "未ログイン",
};
```

タップ時は半画面シート（既存の sonner toast とは別の bottom sheet）を表示し、最終同期時刻 + 手動同期ボタン + エラー詳細を出す。シート UI は `src/features/sync/components/SyncStatusSheet.tsx` として新規実装。

`/history` ページへの同期インジケーター追加は Phase 9 では見送り（メイン画面のみで十分判定可能）。Stage 1 §3-1 の「（任意）」に従う。

### 4-8. ログイン/ログアウト UI

#### `/login` ページ

`src/app/login/page.tsx` を新規作成。`'use client'` コンポーネント。

```tsx
'use client';
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  return (
    <main>
      <button onClick={() => router.back()}>← 戻る</button>
      ...
      <button onClick={() => signIn("google", { callbackUrl: "/" })}>
        Google でログイン
      </button>
      <button onClick={() => router.push("/")}>後で（ログインなしで使う）</button>
    </main>
  );
}
```

**戻るボタンの履歴フォールバック**: `router.back()` の代わりに `if (window.history.length <= 1) router.push('/')` 相当をラップしたフックを使う。

#### 設定画面の変更

`src/features/shopping/components/SettingsView.tsx` 冒頭に `<AccountSection />` を追加。

`<AccountSection />` の構成:
- `useSession()` で session 取得
- ログイン中: メールアドレス + 最終同期時刻 + 「ログアウト」ボタン
- 未ログイン: 「Google でログイン」ボタン + 「端末間でリスト同期」説明文

#### ログアウトフロー

```tsx
const handleLogout = () => {
  // 確認ダイアログ表示（既存の sonner ベースで実装、または Radix Dialog 追加）
  openConfirm({
    title: "ログアウトしますか？",
    description: "サーバーデータは引き続きアカウントに紐づいて保管されます。",
    checkbox: { label: "この端末のローカルデータも削除する", default: false },
    onConfirm: async ({ clearLocal }) => {
      if (clearLocal) useShoppingStore.getState().reset();
      await signOut({ callbackUrl: "/" });
      toast.success("ログアウトしました");
    },
  });
};
```

確認ダイアログは Phase 8.1 のトースト基盤と別物が必要なので、`src/components/common/ConfirmDialog.tsx` を新規実装。Stage 2 では Radix を新規導入せず、`<dialog>` HTML 要素 + ref ベースの命令的 API で実装する。

**実装パターン**:
```tsx
'use client';
import { useRef, useImperativeHandle, forwardRef } from "react";

type ConfirmDialogProps = {
  title: string;
  description: string;
  checkbox?: { label: string; default: boolean };
  onConfirm: (state: { clearLocal: boolean }) => void;
};

export const ConfirmDialog = forwardRef<{ open: () => void }, ConfirmDialogProps>(
  function ConfirmDialog(props, ref) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    useImperativeHandle(ref, () => ({
      open: () => dialogRef.current?.showModal(),
    }), []);

    return (
      <dialog
        ref={dialogRef}
        className="rounded-xl p-0 backdrop:bg-black/40"
      >
        {/* ...title, description, checkbox, buttons... */}
      </dialog>
    );
  }
);
```

**iOS Safari 注意点**:
- `<dialog>` は iOS 15.4+ サポート（本アプリの対応下限と一致）
- `dialog::backdrop` の z-index は Tailwind の `z-*` ユーティリティと干渉する可能性があるため、`backdrop:bg-black/40` の `backdrop:` バリアントを使う
- `showModal()` を呼ばないと backdrop が出ないので、必ず `useImperativeHandle` 経由で命令的に開く

### 4-9. 初回ログイン時のマージフロー

`src/features/sync/hooks/useInitialMerge.ts`（新規）:

```ts
'use client';
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useShoppingStore } from "@/features/shopping/stores/shoppingStore";
import { useSyncStore } from "@/features/sync/stores/syncStore";
import { useLocalStorage } from "@/features/sync/hooks/useLocalStorage";
import { syncClient } from "@/features/sync/services/syncClient";

const HAS_MERGED_KEY = (userId: string) => `sync:hasMerged:${userId}`;

export function useInitialMerge() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [hasMerged, setHasMerged] = useLocalStorage(
    userId ? HAS_MERGED_KEY(userId) : null,
    false
  );

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    if (hasMerged === true) return; // null キー時の defaultValue (false) と未 hydration の undefined を区別

    const localItems = useShoppingStore.getState().items;
    syncClient.mergeOnLogin({ localItems }).then((res) => {
      useShoppingStore.getState().setItems(res.finalItems);
      useSyncStore.getState().setLastUpdatedAt(res.lastUpdatedAt);
      setHasMerged(true);
      toast.success(
        `ローカルから${res.uploadedCount}件をサーバーへ送信、サーバーから${res.downloadedCount}件取得しました`
      );
    });
  }, [status, userId, hasMerged, setHasMerged]);
}
```

**キー設計**:
- `sync:hasMerged:${userId}` でユーザー単位に分離（前ユーザーのフラグが新ユーザーに混入しない）
- `useLocalStorage` のキー引数が `null` の場合は何もしない（未ログイン時の no-op）。**戻り値は `[defaultValue, () => {}]` を返す**（`undefined` を返さないことで二重マージを防ぐ）

**`useEffect` 内のガード**: `if (hasMerged)` ではなく **`if (hasMerged === true) return`** を使う。これにより null キー時の defaultValue（false）と、まだ hydration されていない `undefined` の双方で安全に弾ける。

#### `useLocalStorage` の実装仕様

`src/features/sync/hooks/useLocalStorage.ts`（新規）。設計書の他フックと共通の最小フックとして定義する:

```ts
"use client";
import { useEffect, useState, useCallback } from "react";

export function useLocalStorage<T>(
  key: string | null,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  // SSR ガード: 初回マウント時にのみ localStorage から読む
  useEffect(() => {
    if (typeof window === "undefined" || key === null) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // JSON parse 失敗 or アクセス拒否（プライベートモード等）→ defaultValue のまま
    }
  }, [key]);

  const setAndPersist = useCallback((next: T) => {
    setValue(next);
    if (typeof window === "undefined" || key === null) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // QuotaExceeded 等は無視（同期フラグなので失っても致命的でない）
    }
  }, [key]);

  return [value, setAndPersist];
}
```

**設計判断**:
- **SSR 対応**: 初期 state は常に `defaultValue`、`useEffect` で localStorage 読み込み（hydration mismatch を回避）
- **エラーハンドリング**: parse 失敗・容量超過・アクセス拒否はすべて握りつぶす（同期フラグは失っても次回マージで吸収可能）
- **`null` キー対応**: 未ログイン時に `null` を渡すと no-op で `defaultValue` を返す

**ログアウト時のキークリア**: §4-8 の `handleLogout` 内で、signOut の**前に**以下を実行する:

```ts
// handleLogout 内
const userId = session?.user?.id;
if (userId) localStorage.removeItem(`sync:hasMerged:${userId}`);
if (clearLocal) useShoppingStore.getState().reset();
await signOut({ callbackUrl: "/" });
```

### 4-10. トースト通知の文言とタイミング

| タイミング | 文言例 | sonner type |
|----------|--------|------------|
| 初回ログイン マージ完了 | "ローカルから5件を送信、サーバーから2件取得しました" | success |
| 別端末上書き発生 | "別端末の更新で2件が最新版に置き換わりました" | info（toast.message） |
| 同期エラー（リトライ全失敗） | "同期に失敗しました。タップで再試行" | error |
| ログイン成功 | "ログインしました" | success |
| ログアウト完了 | "ログアウトしました" | success |
| オンライン復帰 | （トースト出さず、ドット色のみ更新） | - |

オーバーレイ衝突を避けるため、上書き通知は同期完了後 200ms 待ってから表示する（既存トーストと重ならないように）。

### 4-11. エラー・例外シナリオ実装

| シナリオ | 実装 |
|---------|------|
| OAuth 認可失敗 | NextAuth が `/login?error=...` にリダイレクト。`/login` の `searchParams.error` を見てトースト表示 |
| 5xx | syncClient のリトライ機構で対応 |
| クライアント側のクロックずれ | レスポンスの `serverTime` と `Date.now()` の差を `syncStore.clockSkewMs` に記録。`updatedAt` 発行時に補正 |
| 401 | syncClient が catch して `signOut()` + `status = "logged_out"` |
| ローカルとサーバーで `id` 衝突 | クライアント発行 UUID v4 の衝突確率は無視可能。サーバー側で同 id の `userId` 不一致は 403 を返す（マルチテナント防御） |
| 同期中にユーザーがログアウト | `signOut` 前に `syncOrchestrator.cancel()` で進行中リクエストを AbortController で打ち切り |

### 4-12. 影響を受ける既存ファイル一覧

新規:
- `prisma/schema.prisma`（全面更新）
- `prisma/migrations/`（自動生成）
- `src/lib/auth.ts`
- `src/lib/api/sync-helpers.ts`（`requireSession` / `badRequest` / `internalError` ヘルパー）
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/sync/items/route.ts`
- `src/app/api/sync/merge/route.ts`
- `src/app/login/page.tsx`
- `src/types/sync.ts`
- `src/types/next-auth.d.ts`
- `src/features/sync/stores/syncStore.ts`
- `src/features/sync/services/syncClient.ts`
- `src/features/sync/services/syncOrchestrator.ts`
- `src/features/sync/services/reconcile.ts`
- `src/features/sync/hooks/useSyncStatus.ts`
- `src/features/sync/hooks/useSyncOnMount.ts`
- `src/features/sync/hooks/useInitialMerge.ts`
- `src/features/sync/hooks/useLocalStorage.ts`
- `src/features/sync/components/SyncStatusDot.tsx`
- `src/features/sync/components/SyncStatusSheet.tsx`
- `src/features/sync/components/LoginButton.tsx`
- `src/components/common/ConfirmDialog.tsx`
- `src/components/providers/SessionProvider.tsx`（クライアント Provider のラッパー）
- `src/components/providers/SyncProvider.tsx`（`createSyncOrchestrator()` の起動と HMR 対応）
- `.env.example`
- `tools/scripts/generate-table-docs.ts`（既存ならテーブル追加、無ければ新規）

変更:
- `src/app/layout.tsx`（SessionProvider でラップ）
- `src/features/shopping/components/ShoppingMainView.tsx`（同期ドット追加）
- `src/features/shopping/components/SettingsView.tsx`（AccountSection 追加 + データセクション説明文）
- `src/features/shopping/components/OnboardingModal.tsx`（**最終ステップに「Google でログイン / ログインせず使う」の二択ボタン追加**。Stage 1 §3-3 のレイアウトに従う。`router.push('/login')` でログイン遷移、もう片方は `setHasOnboarded(true)` のみ）
- `src/features/shopping/stores/shoppingStore.ts`（`setItems` / `applyServerChanges` 追加）
- `tools/export-to-sql.ts`（`User` / `Account` / `Session` / `VerificationToken` / `ShoppingItem` / `DeletionTombstone` を `ORDERED_TABLES` と `DB_TABLE_MAP` に追加）
- `.env.example`（**Phase 9 で必要な環境変数を日本語コメント付きで追記済み**）
- `docs/設計書/API一覧.md` / `テーブル定義書.md` / `ER図.md` / `サービス・リポジトリ一覧.md` / `フック一覧.md`（実装後 `/update-docs` で同期）
- `package.json`（`next-auth@5` / `@auth/prisma-adapter` / `zod` 追加）
- `.claude/01_development_docs/03_api_design.md`（API パスバージョニング方針を「Phase 9 時点では `v1` プレフィクスなし」に更新）

### 4-13. 実装順序（タスク 5-13 の細分化）

1. `next-auth@5` / `@auth/prisma-adapter` / `zod` を追加 → 型エラーが出ないことを確認
2. Prisma スキーマ更新 → `prisma migrate dev` → `tools/export-to-sql.ts` 更新
3. `src/lib/auth.ts` + `[...nextauth]/route.ts` + `SessionProvider` → `/login` ページ動作確認
4. `src/types/sync.ts` 作成 → API route の骨組み（401/400 ハンドリング）
5. `GET /api/sync/items` 実装 + 単体動作確認（curl + 認証 cookie）
6. `PUT /api/sync/items` 実装 + LWW 検証
7. `POST /api/sync/merge` 実装 + マージケース検証
8. `src/features/sync/` 一式実装（store → client → orchestrator → hooks）
9. `ShoppingMainView` にドット追加 + `SettingsView` に AccountSection 追加
10. `useInitialMerge` フック実装 + マージトースト確認
11. `OnboardingModal` 最終ステップへの「Google でログイン / ログインせず使う」二択ボタン追加（§3-3 レイアウト準拠）+ ログアウト確認ダイアログ (`ConfirmDialog`) 実装
12. `/build-check` → `/code-review` → `/browser-test`（複数端末シナリオ含む）
13. `/update-docs` → `/sync-check` → コミット → プッシュ

### 4-14. Stage 2 レビュー記録

| 日付 | レビューファイル | 判定 | 対応 |
|------|-----------------|------|------|
| 2026-05-04 | `docs/reviews/20260504_141824_design-review-tech-phase9.md` | ⚠️ 条件付き承認 | 全 19 件反映済み（v1.3） |
| 2026-05-04 | `docs/reviews/20260504_144219_design-review-tech-phase9-2nd.md` | ⚠️ 条件付き承認 | 新規指摘 15 件（N1-N15）: 全件反映済み（v1.4）。3回目レビューはスキップしユーザー目視確認で承認 |

---

## 5. ブラウザ評価計画

### 主要シナリオ（必須）

| # | シナリオ | 手順 | 期待結果 |
|---|---------|------|---------|
| M0a | **初回起動 → オンボーディング → 「ログインせず使う」を選択** | LocalStorage クリアした状態でアプリを開く | OnboardingModal が表示され、最終ステップで「Google でログイン / ログインせず使う」の二択が表示される。「ログインせず使う」をタップ → モーダルが閉じてメイン画面で通常利用できる。サーバー通信が発生しない |
| M0b | **初回起動 → オンボーディング → 「Google でログイン」を選択** | 同上 → 「Google でログイン」をタップ | `/login` に遷移し、Google OAuth フロー → 完了後メイン画面に戻り、`hasOnboarded = true` かつログイン状態 |
| M1 | 未ログイン → ログイン → 既存ローカルデータがマージされる | 未ログイン状態でアイテムを5件追加 → 設定 → Google ログイン | 設定画面に戻り、メイン画面に5件表示される。トースト「ローカルから5件を送信、サーバーから0件取得しました」 |
| M2 | ログイン中の編集が debounce 後にサーバーへ送信される | 1秒以内に3件追加 → 1.5秒待機 → DevTools の Network タブを確認 | `PUT /api/sync/items` が1回だけ発火、upserts に3件含まれる |
| M3 | 別タブでログインして同じリストが表示される | ログイン済タブを開いたまま別タブで `/` を開く | 同じアイテム一覧が表示される |
| M4 | オフライン編集 → 復帰時に自動送信 | DevTools で Offline → アイテム追加 → Online に戻す | ヘッダーのドットが灰 → 黄 → 緑に変化、サーバーに反映 |
| M5 | ログアウト（ローカル保持） | ログアウト確認ダイアログでチェックボックス OFF → ログアウト | ローカルにデータが残る、再ログインで同じリスト |
| M6 | ログアウト（ローカル削除） | ログアウト確認ダイアログでチェックボックス ON → ログアウト | ローカルが空、オンボーディングモーダルが再表示 |

### エッジケース（少なくとも E1-E3 は必須）

| # | シナリオ | 期待結果 |
|---|---------|---------|
| E1 | 2タブで同一アイテムを別内容に編集 → 後勝ち | LWW で後の `updatedAt` が勝つ。負けた側のタブでは事後トースト表示 |
| E2 | 別端末（タブ）で削除 → こちらのタブで GET 発火（focus イベント） | ローカルからも消える |
| E3 | OAuth 認可エラー | `/login?error=...` に戻り、エラートースト表示 |
| E4 | サーバー 5xx を3回連続返す | リトライ3回後にドット赤、タップで再試行可 |
| E5 | クロックずれた端末（手動で時刻を5分ずらす）で編集 | `serverTime` 補正により他端末と整合性が取れる |
| E6 | 別ユーザーでログイン直後 | 前ユーザーのローカルデータは `useInitialMerge` の `hasMerged` キー切り替えにより新ユーザーに混入しない |

### 計測項目

- 初回ログイン → メイン画面表示までの時間（500件想定で 3秒以内）
- debounce 中の連続編集による PUT 回数（5件連続編集で1回）
- オフライン → オンライン復帰の自動同期遅延（1秒以内）

### テストツール

- 主に手動（Chrome DevTools の Network throttling / Offline モード使用）
- 2端末シナリオは 1ブラウザ + シークレットウィンドウで近似
- `/browser-test` Skill 経由で Playwright MCP による自動回帰テストを将来追加（Phase 9 では手動のみ）

---

## 6. 関連ドキュメント

| ドキュメント | 関連内容 |
|-------------|---------|
| [企画書 v0.3](../企画書.md) | §4.2 F-20/F-21、§7 データモデル、§8 技術スタック |
| [.claude/03_library_docs/](../../.claude/03_library_docs/) | NextAuth ガイド（Phase 0 で削除済み、再追加要） |

---

## 7. 注意事項

- 既存の MVP 体験（ログインなし）を**絶対に壊さない**こと。ログインは完全にオプショナル
- 通信エラーで UI がブロックしないよう、すべての同期処理は非同期 + 楽観的更新
- セキュリティ: OAuth クライアントシークレットは環境変数のみ、コミット禁止
- 課金影響: Vercel + 無料 PostgreSQL（Neon/Supabase 等）で運用想定。スケール時は別検討
- **GDPR / アカウント削除**（T15 対応）: Phase 9 ではアカウント削除 UI は実装しない。`User` Cascade 削除の定義のみ用意。**Phase 9.1 のタスクとして「設定画面にアカウント削除ボタン + 削除確認 + DB 削除 API」を追加する**ことを記録（後述「将来タスク」参照）
- **レート制限**（T16 対応）: Phase 9 では明示的なレート制限を入れず、Vercel Edge デフォルトと debounce による自然制限に任せる。本格運用で問題が出た場合、Vercel Edge IP レート制限（無料枠あり）または Upstash Redis での実装を Phase 9.1 で検討
- **監査ログ**（T18 対応）: Phase 9 では `console.log` + Vercel Function ログで代替。同期 API のリクエスト/レスポンスを最小情報（userId, action, count）で出力する。本格的な監査ログ（DB テーブル化、外部送信）は将来フェーズ

### 将来タスク（Phase 9.1 以降）

- アカウント削除 UI + API（GDPR 対応）
- `DeletionTombstone` の定期クリーンアップバッチ（30日経過分削除）
- レート制限の本格実装
- tombstone 方式による削除の更新時刻ベース同期（hard delete から soft delete への移行検討）

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-05-04 | (未確定) | 初版作成（Stage 1 ドラフト） | Claude Code |
| 1.1 | 2026-05-04 | (未確定) | Stage 1 設計レビュー対応（C1-C9, P1-P8 の17件を反映）。Stage 1 を ✅ 確定 | Claude Code |
| 1.2 | 2026-05-04 | (未確定) | Stage 2 技術設計ドラフト記入（DB スキーマ、API 設計、共有型、同期サービス、UI 実装方針）。NextAuth バージョン選定はユーザー判断待ち | Claude Code |
| 1.3 | 2026-05-04 | (未確定) | Auth.js v5 採用確定。Stage 1 改訂（OnboardingModal 最終ステップに「Google でログイン / ログインせず使う」二択ボタン追加）。Stage 2 レビュー指摘対応（T1-T19、19件反映: route.ts パス修正・API ラッパー方針確定・PUT/POST レスポンス JSON 例追加・所有権チェック修正・共有型 DTO 分離・hasMerged キー修正・GET serverDeletes 追加・DeletionTombstone モデル追加・クロックずれ補正方針明示・syncStore partialize 明示・API パスバージョニング方針確定・since:null 扱い明示・LWW 同値時挙動明文化・deleteItem 検知擬似コード追加・GDPR/レート制限/監査ログ将来タスク化・dialog 実装パターン追加・STATUS_LABEL 定義追加）。`.env.example` を Phase 9 用に更新 | Claude Code |
| 1.4 | 2026-05-04 | (未確定) | Stage 2 2回目レビュー指摘対応（N1-N15、15件反映: POST merge レスポンス JSON 例追加・ShoppingItemDTO を Omit 型に変更・GET/POST の Zod スキーマ追加・PUT スキーマに strict() で userId 拒否・DeletionTombstone を upsert 方針に変更・syncOrchestrator を factory 関数化 + クライアント専用ガード・useLocalStorage 実装仕様追記・SyncPushResponse 系も DTO 型に統一・GET の不正 since 扱い明示・§4-12 ファイル一覧の精緻化・§4-13 OnboardingModal 改訂表現修正・§4-14 レビュー記録更新）。Stage 2 を ✅ 確定 | Claude Code |
