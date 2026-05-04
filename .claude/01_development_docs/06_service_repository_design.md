# サービス・リポジトリ設計

## レイヤー構造

```
┌─────────────────────────────┐
│  API Route Handler          │ リクエスト受付・バリデーション・レスポンス
├─────────────────────────────┤
│  Service Layer              │ ビジネスロジック・トランザクション管理
├─────────────────────────────┤
│  Prisma Client / Repository │ データアクセス
└─────────────────────────────┘
```

**設計方針**: MVPではService層で直接Prisma Clientを使用する。テーブル数が少なく（11テーブル）、Repository パターンによる抽象化のメリットが小さいため。AI Provider系のみ既存のRepositoryパターンを維持する。

---

## 1. サービス一覧

### 1.1 既存サービス

| サービス名 | ファイルパス | 説明 | 変更 | 実装状態 |
|-----------|-------------|------|------|---------|
| AISummarizeService | `src/lib/ai/services/aiSummarizeService.ts` | AI生成サービス（Claude/Gemini/Azure対応） | プロンプト拡張 | ✅ 実装済み |
| aiCallWrapper | `src/lib/ai/services/aiCallWrapper.ts` | AI呼び出し共通ラッパー（タイムアウト・リトライ・フォールバック） | Phase 2で追加 | ✅ 実装済み |
| aiUsageService | `src/lib/ai/services/aiUsageService.ts` | AI利用制限チェック・利用履歴記録 | 変更なし | ✅ 実装済み |
| userAIProviderService | `src/lib/ai/services/userAIProviderService.ts` | ユーザーAIプロバイダー管理・APIキー暗号化 | 変更なし | ✅ 実装済み |

### 1.2 新規サービス

| サービス名 | ファイルパス | 説明 | Phase | 実装状態 |
|-----------|-------------|------|-------|---------|
| authService | `src/lib/services/authService.ts` | ユーザー登録・パスワードハッシュ化 | Phase 1 | ✅ 実装済み |
| onboardingService | `src/lib/services/onboardingService.ts` | オンボーディング一括処理（$transaction） | Phase 1 | ✅ 実装済み |
| userProfileService | `src/lib/services/userProfileService.ts` | プロフィールCRUD | Phase 1 | ✅ 実装済み |
| petService | `src/lib/services/petService.ts` | ペット作成・レベルアップ・経験値管理 | Phase 1 | ✅ 実装済み |
| chatSessionService | `src/lib/services/chatSessionService.ts` | セッション作成・状態管理・メッセージ追加 | Phase 2 | ✅ 実装済み |
| chatFlowService | `src/lib/services/chatFlowService.ts` | ライト/ディープ/クイズのフロー制御 | Phase 2 | ✅ 実装済み |
| aiPromptService | `src/lib/services/aiPromptService.ts` | プロンプト生成・AI応答パース・コンテキスト構築 | Phase 2 | ✅ 実装済み |
| knowledgeService | `src/lib/services/knowledgeService.ts` | ナレッジCRUD・ステータス更新・カテゴリ集計 | Phase 3 | ✅ 実装済み |
| knowledgeHistoryService | `src/lib/services/knowledgeHistoryService.ts` | ナレッジ履歴記録・成長履歴取得 | Phase 3 | ⬜ 未実装 |
| expService | `src/lib/services/expService.ts` | 経験値計算・レベルアップ判定・進化段階管理 | Phase 3 | ✅ 実装済み |
| notificationService | `src/lib/services/notificationService.ts` | 通知生成・既読管理・ペット話しかけ判定 | Phase 4 | ⬜ 未実装 |

---

## 2. サービス間の依存関係

```
chatFlowService
  ├── chatSessionService      （セッション管理）
  ├── aiPromptService         （プロンプト生成・AI呼び出し）
  ├── knowledgeService        （ナレッジ自動作成・更新）
  └── expService              （経験値付与）
       └── petService         （レベルアップ判定）

notificationService
  ├── knowledgeService        （ナレッジ状態参照）
  ├── chatSessionService      （最終利用日参照）
  └── aiPromptService         （話しかけメッセージ生成）
```

---

## 3. 各サービスのメソッドシグネチャ

### authService

```typescript
register(email: string, password: string): Promise<User>
verifyPassword(email: string, password: string): Promise<User | null>
```

### onboardingService

```typescript
// $transaction内でプロフィール + ペット作成
completeOnboarding(userId: string, data: OnboardingInput): Promise<{ profile: UserProfile; pet: Pet }>
```

### userProfileService

```typescript
getProfile(userId: string): Promise<UserProfile | null>
upsertProfile(userId: string, data: ProfileInput): Promise<UserProfile>
```

### petService

```typescript
getPet(userId: string): Promise<Pet | null>
createPet(userId: string, name: string): Promise<Pet>
getPetStatus(userId: string): Promise<PetStatusDetail>
```

### chatSessionService

```typescript
createSession(userId: string, keyword: string): Promise<ChatSession>
listSessions(userId: string, options: ListOptions): Promise<PaginatedResult<ChatSession>>
getSession(userId: string, sessionId: string): Promise<ChatSessionDetail>
addMessage(sessionId: string, message: MessageInput): Promise<ChatMessage>
updateStatus(sessionId: string, status: ChatSessionStatus): Promise<void>
```

### chatFlowService

```typescript
executeLightMode(userId: string, sessionId: string): Promise<LightModeResult>
executeDeepHearing(userId: string, sessionId: string): Promise<DeepHearingResult>
executeDeepExplanation(userId: string, sessionId: string, purpose: string): Promise<DeepExplanationResult>
executeFreeQuestion(userId: string, sessionId: string, question: string): Promise<FreeQuestionResult>
executeQuiz(userId: string, sessionId: string): Promise<QuizResult>
judgeQuizAnswer(userId: string, sessionId: string, answer: string): Promise<QuizJudgeResult>
```

### aiPromptService

```typescript
buildUserContext(userId: string): Promise<string>
generateLightMode(keyword: string, context: string): Promise<LightModeResponse>
generateDeepExplanation(keyword: string, purpose: string, history: ChatMessage[], context: string): Promise<DeepExplanationResponse>
generateQuiz(keyword: string, history: ChatMessage[], context: string): Promise<QuizResponse>
parseAIResponse<T>(rawResponse: string, schema: ZodType<T>): T
```

### knowledgeService

```typescript
listKnowledge(userId: string, options: KnowledgeListOptions): Promise<PaginatedResult<Knowledge>>
getKnowledge(userId: string, knowledgeId: string): Promise<KnowledgeDetail>
createFromLightMode(userId: string, data: LightModeResponse, sessionId: string): Promise<Knowledge>
updateFromChatFlow(knowledgeId: string, update: KnowledgeUpdate): Promise<Knowledge>
updateKnowledge(userId: string, knowledgeId: string, data: KnowledgeInput): Promise<Knowledge>
deleteKnowledge(userId: string, knowledgeId: string): Promise<void>
getCategorySummary(userId: string): Promise<CategorySummary[]>
```

### knowledgeHistoryService

```typescript
recordHistory(knowledgeId: string, from: { status: KnowledgeStatus; level: number }, to: { status: KnowledgeStatus; level: number }, reason: string): Promise<KnowledgeHistory>
getRecentGrowth(userId: string, limit?: number): Promise<KnowledgeHistory[]>
```

### expService

```typescript
addExp(userId: string, amount: number, reason: string): Promise<ExpResult>
canGrantQuizAttemptExp(userId: string, knowledgeId: string): Promise<boolean>
calculateExpToNext(level: number): number
determineStage(level: number): PetStage
```

### notificationService

```typescript
listNotifications(userId: string, options: NotificationListOptions): Promise<PaginatedResult<Notification>>
getUnreadCount(userId: string): Promise<number>
markAsRead(userId: string, notificationId: string): Promise<void>
markAllAsRead(userId: string): Promise<number>
generatePetInitiative(userId: string): Promise<Notification | null>
```

### aiCallWrapper

```typescript
callAIWithRetry<T>(fn: () => Promise<T>, options?: { maxRetries?: number; timeoutMs?: number }): Promise<T>
getFallbackResponse(type: "light" | "deep" | "quiz"): FallbackResponse
```

---

## 4. リポジトリ一覧

AI Provider系のみRepositoryパターンを維持。

| リポジトリ名 | ファイルパス | 対応サービス |
|-------------|-------------|-------------|
| ClaudeRepository | `src/lib/ai/repositories/claudeRepository.ts` | AISummarizeService |
| GeminiRepository | `src/lib/ai/repositories/geminiRepository.ts` | AISummarizeService |
| AzureOpenAIRepository | `src/lib/ai/repositories/azureOpenAIRepository.ts` | AISummarizeService |

---

## 5. API・サービス・データ・フック対応表

| APIパス | メソッド | サービス | データアクセス | フック | Phase | 実装状態 |
|---------|---------|---------|--------------|--------|-------|---------|
| `/api/v1/auth/register` | POST | authService | Prisma (User) | useRegister | 1 | ✅ |
| `/api/auth/[...nextauth]` | GET, POST | authService | Prisma (User) | useAuth | 1 | ✅ |
| `/api/v1/onboarding/complete` | POST | onboardingService | Prisma [$transaction] | useCompleteOnboarding | 1 | ✅ |
| `/api/v1/user/profile` | GET | userProfileService | Prisma (UserProfile) | useProfile | 1 | ✅ |
| `/api/v1/user/profile` | PUT | userProfileService | Prisma (UserProfile) | useUpdateProfile | 1 | ✅ |
| `/api/v1/pet` | GET | petService | Prisma (Pet) | usePet | 1 | ✅ |
| `/api/v1/pet` | POST | petService | Prisma (Pet) | useCreatePet | 1 | ✅ |
| `/api/v1/chat/sessions` | GET | chatSessionService | Prisma (ChatSession) | useChatSessions | 2 | ✅ |
| `/api/v1/chat/sessions` | POST | chatSessionService, chatFlowService | Prisma + AI API | useCreateSession | 2 | ✅ |
| `/api/v1/chat/sessions/[id]` | GET | chatSessionService | Prisma (ChatSession, ChatMessage) | useChatSession | 2 | ✅ |
| `/api/v1/chat/sessions/[id]/messages` | POST | chatFlowService, aiPromptService | Prisma + AI API | useSendMessage | 2 | ✅ |
| `/api/v1/chat/sessions/[id]/light` | POST | chatFlowService, aiPromptService, knowledgeService, expService | Prisma + AI API | （内部API） | 2 | ⬜ |
| `/api/v1/chat/sessions/[id]/quiz` | POST | chatFlowService, aiPromptService | Prisma + AI API | （内部API） | 2 | ✅ |
| `/api/v1/knowledge` | GET | knowledgeService | Prisma (Knowledge) | useKnowledgeList | 3 | ⬜ |
| `/api/v1/knowledge/categories` | GET | knowledgeService | Prisma (Knowledge) | useKnowledgeCategories | 3 | ⬜ |
| `/api/v1/knowledge/[id]` | GET | knowledgeService | Prisma (Knowledge, KnowledgeHistory) | useKnowledgeDetail | 3 | ⬜ |
| `/api/v1/knowledge/[id]` | PATCH | knowledgeService | Prisma (Knowledge) | useUpdateKnowledge | 3 | ⬜ |
| `/api/v1/knowledge/[id]` | DELETE | knowledgeService | Prisma (Knowledge, KnowledgeHistory, ChatSession) | useDeleteKnowledge | 3 | ⬜ |
| `/api/v1/pet/status` | GET | petService, knowledgeService, knowledgeHistoryService | Prisma (Pet, Knowledge, KnowledgeHistory) | usePetStatus | 3 | ⬜ |
| `/api/v1/notifications` | GET | notificationService | Prisma (Notification) | useNotifications | 4 | ⬜ |
| `/api/v1/notifications/unread-count` | GET | notificationService | Prisma (Notification) | useUnreadCount | 4 | ⬜ |
| `/api/v1/notifications/read-all` | POST | notificationService | Prisma (Notification) | - | 4 | ⬜ |
| `/api/v1/notifications/[id]/read` | PATCH | notificationService | Prisma (Notification) | useMarkAsRead | 4 | ⬜ |
| `/api/v1/notifications/trigger` | POST | notificationService, aiPromptService | Prisma + AI API | （Cron内部API） | 4 | ⬜ |
| `/api/settings/ai-providers` | CRUD | userAIProviderService | Prisma (UserAIProvider, UserAISetting) | - | 既存 | ⬜ |

---

## 6. サービス対応図

```
┌────────────────────────────────────────────────────────────┐
│                      API Route Handlers                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  authService ─────────────────────────── Prisma (User)     │
│  onboardingService ──────────────────── Prisma [$transaction] │
│  userProfileService ──────────────────── Prisma (UserProfile) │
│  petService ──────────────────────────── Prisma (Pet)      │
│                                                             │
│  chatSessionService ──────────────────── Prisma (ChatSession, ChatMessage) │
│  chatFlowService ─┬── aiPromptService                      │
│                    ├── chatSessionService                   │
│                    ├── knowledgeService                     │
│                    └── expService                           │
│                                                             │
│  aiPromptService ─┬── AISummarizeService                   │
│                    └── AI Prompt Templates                   │
│                                                             │
│  AISummarizeService ─┬── ClaudeRepository ──── Anthropic API │
│                       ├── GeminiRepository ──── Google AI API │
│                       └── AzureOpenAIRepository ── Azure API │
│                                                             │
│  knowledgeService ────────────────────── Prisma (Knowledge, KnowledgeHistory) │
│  expService ──────────────────────────── Prisma (Pet)      │
│  notificationService ────────────────── Prisma (Notification) │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 改訂履歴

| 版数 | 日付 | 内容 | 担当 |
|------|------|------|------|
| 1.0 | 2026-04-02 | 初版作成（docs/から移行） | Claude Code |
| 1.1 | 2026-04-02 | サービス一覧・API対応表に実装状態カラム追加 | Claude Code |
