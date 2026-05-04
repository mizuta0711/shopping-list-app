# 型定義設計

## 概要

TypeScript strict mode、**any型は完全禁止**。不明な型は`unknown` + 型ガードで対応する。

---

## 1. Enum型（Prismaスキーマ連動）

```typescript
// Prisma生成型を使用するが、参照用に定義を記載

type PetStage = 'puppy' | 'young' | 'adult';

type ChatSessionStatus = 'active' | 'light_completed' | 'deep_completed' | 'quiz_completed' | 'archived';

type MessageSender = 'user' | 'pet';

type MessageType = 'text' | 'light_response' | 'deep_hearing' | 'deep_explanation'
  | 'quiz' | 'quiz_result' | 'next_step' | 'pet_initiative';

type KnowledgeStatus = 'memo' | 'learning' | 'known';

type NotificationType = 'retention_check' | 'review_reminder' | 'continuity_prompt' | 'light_completed';

type AIProviderType = 'gemini' | 'azure_openai' | 'claude';

type AIUsageType = 'chat' | 'generate' | 'edit';
```

---

## 2. コアエンティティ型

### User

```typescript
interface User {
  id: string;
  email: string;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### UserProfile（フロントエンド用: `src/types/index.ts`）

```typescript
interface UserProfile {
  name: string;              // フロントではname、APIではdisplayName
  petName: string;
  specialties: string[];
  technologies: string[];
  experienceYears: string;   // "1年未満" | "1〜3年" | "3〜5年" | "5年以上"
  currentProject: string;
  onboardingCompleted: boolean;
}
```

> **注意**: DB/API側の `UserProfile` は `id`, `userId`, `displayName`, `notificationPreferences`, `createdAt`, `updatedAt` 等の追加フィールドを持つ。フロントエンド用の型はZustandストアのキャッシュ用途。

### Pet

```typescript
interface Pet {
  id: string;
  userId: string;
  name: string;
  level: number;
  exp: number;
  expToNext: number;
  stage: PetStage;
  monthStartLevel: number;
  monthStartDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### PetState（フロントエンド用: `src/types/index.ts`）

```typescript
interface PetState {
  name: string;
  level: number;
  exp: number;
  expToNext: number;
  stage: PetStage;  // "puppy" | "young" | "adult"
}
```

### Knowledge（フロントエンド用: `src/types/index.ts`）

```typescript
interface Knowledge {
  id: string;
  title: string;
  category: string;
  status: KnowledgeStatus;       // "memo" | "learning" | "known"
  summary: string;
  customContent: string;
  relatedSkills: string[];
  nextStep: string;
  learnedAt: string;
  internalLevel: 1 | 2 | 3 | 4 | 5;
}
```

> **注意**: DB側の `Knowledge` は `userId`, `keyword`, `lastAccessedAt`, `createdAt`, `updatedAt` 等の追加フィールドを持つ。

### ChatSession

```typescript
interface ChatSession {
  id: string;
  userId: string;
  keyword: string;
  status: ChatSessionStatus;
  knowledgeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}
```

### ChatMessage（DB用）

```typescript
interface ChatMessage {
  id: string;
  sessionId: string;
  sender: MessageSender;
  content: string;
  type: MessageType;
  quickReplies: QuickReply[] | null;
  metadata: MessageMetadata | null;
  createdAt: Date;
}

interface QuickReply {
  label: string;
  value: string;
}

interface MessageMetadata {
  quiz?: {
    correctAnswer: string;
    explanations: Record<string, string>;
  };
}
```

### APIChatMessage（フロントエンド用: `src/types/index.ts`）

```typescript
/** APIから返されるメッセージ型（DB形式準拠） */
interface APIChatMessage {
  id: string;
  sessionId: string;
  sender: "user" | "pet";
  content: string;
  type: MessageType;
  quickReplies?: QuickReply[] | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
```

> **注意**: フロントエンド用の `ChatMessage`（`src/types/index.ts`）は `@deprecated` レガシー型。Phase 3で削除予定。新規コードでは `APIChatMessage` を使用すること。

### KnowledgeHistory

```typescript
interface KnowledgeHistory {
  id: string;
  knowledgeId: string;
  fromStatus: KnowledgeStatus;
  toStatus: KnowledgeStatus;
  fromLevel: number;
  toLevel: number;
  reason: string;
  createdAt: Date;
}
```

### Notification ⬜未実装（Phase 4予定）

```typescript
interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  knowledgeId: string | null;
  isRead: boolean;
  createdAt: Date;
}
```

---

## 3. AI応答型（`src/lib/ai/prompts/types.ts` — Zodスキーマ付き）

### ライトモード応答

```typescript
interface LightModeResponse {
  title: string;
  category: string;
  summary: string;
  customContent: string;
  cautions: string;
  nextStep: string;
  relatedSkills: string[];
  petMessage: string;
}
```

### ディープモード応答

```typescript
interface DeepHearingResponse {
  petMessage: string;
  quickReplies: QuickReply[];
}

interface DeepExplanationResponse {
  petMessage: string;
  updatedSummary: string;
  updatedCustomContent: string;
  additionalRelatedSkills: string[];
}

interface FreeQuestionResponse {
  petMessage: string;
  shouldUpdateKnowledge: boolean;
  knowledgeUpdate?: {
    additionalContent: string;
    additionalRelatedSkills: string[];
  };
}
```

### クイズ応答（AI側: `QuizResponse`）

```typescript
interface QuizResponse {
  petMessage: string;
  quiz: {
    question: string;
    options: { label: string; text: string }[];
    correctAnswer: string;
    explanations: Record<string, string>;
  };
  quickReplies: QuickReply[];
}

interface QuizJudgeResponse {
  petMessage: string;
  isCorrect: boolean;
  nextStepMessage: string;
}
```

### ヘルパー型

```typescript
interface QuizData {
  question: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  explanations: Record<string, string>;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}
```

### ナレッジ整形応答 ⬜未実装（Phase 3予定）

```typescript
interface KnowledgeFormatResponse {
  title: string;
  category: string;
  summary: string;
  customContent: string;
  relatedSkills: string[];
  nextStep: string;
}
```

### 通知応答 ⬜未実装（Phase 4予定）

```typescript
interface NotificationGenerateResponse {
  title: string;
  content: string;
}
```

---

## 4. APIレスポンス型（`src/types/index.ts`）

### 共通ラッパー

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, string>;  // ⬜未実装（設計上定義済み）
  };
}
```

### セッション作成レスポンス

```typescript
interface CreateSessionResponse {
  session: { id: string; keyword: string; status: string };
  message: { content: string; type: string; quickReplies?: QuickReply[] };
  knowledge: { id: string; title: string; category: string };
  expResult: { levelUp: boolean; currentLevel: number; currentExp: number };
}
```

### メッセージ送信レスポンス

```typescript
interface SendMessageResponse {
  message: { content: string; type: string; quickReplies?: QuickReply[] | unknown };
  expResult?: { levelUp: boolean; currentLevel: number; currentExp: number };
  isCorrect?: boolean;
  remainingQuestions?: number;
}
```

### クイズAPIレスポンス（`QuizAnswerResponse`）

```typescript
/** API側のクイズ回答レスポンス。AI側の QuizResponse とは別の型。 */
interface QuizAnswerResponse {
  message: { content: string; type: string; quickReplies?: QuickReply[] | unknown };
  isCorrect?: boolean;
  expResult?: { levelUp: boolean; currentLevel: number; currentExp: number };
}
```

> **QuizResponse の名前衝突について**: `QuizResponse` はAI応答型（`src/lib/ai/prompts/types.ts`）で使用されているため、API側のクイズ回答レスポンスは `QuizAnswerResponse`（`src/types/index.ts`）として定義している。

### ページネーション型 ⬜未実装（設計上定義済み）

```typescript
interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}
```

### 定数

```typescript
const STATUS_ICONS: Record<KnowledgeStatus, string> = {
  memo: "📝", learning: "📖", known: "📚",
};

const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  memo: "メモした", learning: "勉強中", known: "よく知ってる",
};
```

---

## 5. Zustandストア型

### userStore

```typescript
// UserProfile型を継承（src/types/index.tsのUserProfile）
interface UserStore extends UserProfile {
  setProfile: (partial: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  setFromAPI: (data: APIUserData) => void;  // displayName→nameのマッピングあり
  resetAll: () => void;
}
```

### chatStore

```typescript
// 永続化なし（persist未使用、インメモリのみ）
interface ChatStore {
  currentSessionId: string | null;
  messages: APIChatMessage[];
  isSending: boolean;
  setCurrentSession: (sessionId: string, messages?: APIChatMessage[]) => void;
  addMessage: (message: APIChatMessage) => void;
  addMessages: (messages: APIChatMessage[]) => void;
  setIsSending: (flag: boolean) => void;
  clearSession: () => void;
  resetAll: () => void;
}
```

### petStore

```typescript
// PetState型を継承
interface PetStore extends PetState {
  setName: (name: string) => void;
  addExp: (amount: number) => void;
  setFromAPI: (data: APIPetData) => void;
  resetAll: () => void;
}
```

### knowledgeStore

```typescript
interface KnowledgeStore {
  knowledgeList: Knowledge[];
  addKnowledge: (knowledge: Knowledge) => void;
  updateStatus: (id: string, status: KnowledgeStatus) => void;
  getByCategory: () => Record<string, Knowledge[]>;
  getById: (id: string) => Knowledge | undefined;
  searchKnowledge: (query: string) => Knowledge[];
  resetAll: () => void;
}
```

---

## 6. サービス入出力型

### オンボーディング

```typescript
interface OnboardingInput {
  displayName: string;
  specialties: string[];
  technologies: string[];
  experienceYears: string;
  currentProject?: string;
  petName: string;
}
```

### チャット

```typescript
interface MessageInput {
  content: string;
  action?: 'free_text' | 'deep' | 'quiz_answer' | 'continue';
}

interface LightModeResult {
  petMessage: ChatMessage;
  knowledge: Knowledge;
  expGained: number;
}

interface QuizJudgeResult {
  feedbackMessage: ChatMessage;
  isCorrect: boolean;
  expGained: number;
  knowledgeUpdate: Knowledge | null;
}
```

### 経験値

```typescript
interface ExpResult {
  previousLevel: number;
  newLevel: number;
  previousExp: number;
  newExp: number;
  leveledUp: boolean;
  newStage: PetStage | null; // 進化した場合のみ
}
```

---

## 7. 型安全性ルール

### 禁止パターン

```typescript
// 絶対禁止
const data: any = response.data;
const items: any[] = getItems();
const result = response as any;
```

### 推奨パターン

```typescript
// unknown + 型ガード
const unknownData: unknown = response.data;
if (isApiResponse(unknownData)) { /* 型安全 */ }

// union型
const status: 'loading' | 'success' | 'error' = getStatus();

// ジェネリクス
function processData<T>(data: T[]): T[] {
  return data.filter(item => item !== null);
}

// イベントハンドラー
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { ... };
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... };
```

---

## 改訂履歴

| 版数 | 日付 | 内容 | 担当 |
|------|------|------|------|
| 1.0 | 2026-04-02 | 初版作成（docs/から移行） | Claude Code |
| 1.1 | 2026-04-02 | 実装との整合性修正: UserProfile/PetState/Knowledge/APIChatMessage/ChatStoreの実態反映、QuizResponse→QuizAnswerResponseリネーム説明追加、未実装機能にPhase注記追加 | Claude Code |
