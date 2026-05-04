# フック・状態管理設計

## 概要

既存のZustand Storeベースのフックを、API連携フックに段階的に移行する。Zustand StoreはフロントエンドのキャッシュとUI状態管理として残し、永続化先をlocalStorageからAPIに変更。

---

## 1. 既存Zustandストア

### 1.1 ストア一覧

| ストア | キー | ファイルパス | 責務 |
|--------|------|-------------|------|
| userStore | `skillup-user` | `src/features/onboarding/stores/userStore.ts` | ユーザープロフィール、オンボーディング状態 |
| chatStore | **なし（永続化なし）** | `src/features/chat/stores/chatStore.ts` | チャットセッション・メッセージ管理（インメモリ） |
| petStore | `skillup-pet` | `src/features/pet/stores/petStore.ts` | ペットレベル、経験値、進化段階 |
| knowledgeStore | `skillup-knowledge` | `src/features/knowledge/stores/knowledgeStore.ts` | スキルデータベース |

### 1.2 各ストアの状態とアクション

#### userStore
- **永続化**: `persist` ミドルウェア使用（キー: `skillup-user`）
- **状態**: `name`, `petName`, `specialties`, `technologies`, `experienceYears`, `currentProject`, `onboardingCompleted`（UserProfile型を継承）
- **アクション**: `setProfile(partial)`, `completeOnboarding()`, `setFromAPI(data)`, `resetAll()`
- **備考**: `setFromAPI` ではAPIの `displayName` をストアの `name` にマッピング

#### chatStore
- **永続化**: **なし**（`persist` 未使用、インメモリのみ）
- **状態**: `currentSessionId` (string|null), `messages` (APIChatMessage[]), `isSending` (boolean)
- **アクション**: `setCurrentSession(sessionId, messages?)`, `addMessage(msg)`, `addMessages(msgs)`, `setIsSending(flag)`, `clearSession()`, `resetAll()`
- **備考**: 旧 `clearMessages` は廃止、`clearSession` に変更

#### petStore
- **永続化**: `persist` ミドルウェア使用（キー: `skillup-pet`）
- **状態**: `name`, `level`, `exp`, `expToNext`, `stage`（PetState型を継承）
- **アクション**: `setName(name)`, `addExp(amount)`, `setFromAPI(data)`, `resetAll()`
- **レベルアップ式**: `expToNext = 100 + (level - 1) * 50`
- **ステージ判定**: puppy(level<6), young(6≤level<16), adult(level≥16)

#### knowledgeStore
- **永続化**: `persist` ミドルウェア使用（キー: `skillup-knowledge`）
- **状態**: `knowledgeList` (Knowledge[])
- **アクション**: `addKnowledge(k)`, `updateStatus(id, status)`, `getByCategory()`, `getById(id)`, `searchKnowledge(query)`, `resetAll()`

### 1.3 ストアの役割定義（MVP移行方針）

ストアの役割は**APIデータのキャッシュ**に限定する。UIの一時的な状態（モーダル開閉、フォーム入力値、個別ローディング）は `useState` で管理する。ただし `chatStore.isSending` のように複数コンポーネントから参照されるUIステートは例外としてストアに含めてよい。詳細は `.claude/03_library_docs/02_state_management_guide.md` を参照。

**chatStore のみ永続化なし**（persist未使用）。メッセージはDBに保存されるため localStorage への永続化は不要。

### 1.4 ストア設計原則

**分離**: 機能ごとに独立したストア（関心の分離）

**永続化**: `persist`ミドルウェアでlocalStorageに永続化（chatStoreを除く）
```typescript
export const usePetStore = create<PetStore>()(
  persist(
    (set) => ({ /* state & actions */ }),
    { name: 'skillup-pet', storage: createJSONStorage(() => localStorage) }
  )
);
```

**不変性**: 配列・ネストオブジェクトは新しい参照を作成
```typescript
addKnowledge: (knowledge) => set((state) => ({
  knowledgeList: [...state.knowledgeList, knowledge],
})),
```

---

## 2. 新規API連携フック

### 2.1 認証フック (Phase 1)

| フック名 | ファイルパス | API | 説明 |
|---------|-------------|-----|------|
| useAuth | `src/features/auth/hooks/useAuth.ts` | NextAuth session | セッション管理・ログイン状態 |
| useRegister | `src/features/auth/hooks/useRegister.ts` | POST `/api/v1/auth/register` | 新規登録 |

### 2.2 プロフィールフック (Phase 1)

| フック名 | ファイルパス | API | 説明 |
|---------|-------------|-----|------|
| useProfile | `src/features/onboarding/hooks/useProfile.ts` | GET `/api/v1/user/profile` | プロフィール取得 |
| useUpdateProfile | `src/features/onboarding/hooks/useUpdateProfile.ts` | PUT `/api/v1/user/profile` | プロフィール更新 |

### 2.3 ペットフック (Phase 1 / Phase 3)

| フック名 | ファイルパス | API | Phase |
|---------|-------------|-----|-------|
| usePet | `src/features/pet/hooks/usePet.ts` | GET `/api/v1/pet` | 1 |
| useCreatePet | `src/features/pet/hooks/useCreatePet.ts` | POST `/api/v1/pet` | 1 |
| usePetStatus | `src/features/pet/hooks/usePetStatus.ts` | GET `/api/v1/pet/status` | 3 |

### 2.4 チャットフック (Phase 2)

| フック名 | ファイルパス | API |
|---------|-------------|-----|
| useChatSessions | `src/features/chat/hooks/useChatSessions.ts` | GET `/api/v1/chat/sessions` |
| useCreateSession | `src/features/chat/hooks/useCreateSession.ts` | POST `/api/v1/chat/sessions` |
| useChatSession | `src/features/chat/hooks/useChatSession.ts` | GET `/api/v1/chat/sessions/[id]` |
| useSendMessage | `src/features/chat/hooks/useSendMessage.ts` | POST `/api/v1/chat/sessions/[id]/messages` |

### 2.5 ナレッジフック (Phase 3)

| フック名 | ファイルパス | API |
|---------|-------------|-----|
| useKnowledgeList | `src/features/knowledge/hooks/useKnowledgeList.ts` | GET `/api/v1/knowledge` |
| useKnowledgeCategories | `src/features/knowledge/hooks/useKnowledgeCategories.ts` | GET `/api/v1/knowledge/categories` |
| useKnowledgeDetail | `src/features/knowledge/hooks/useKnowledgeDetail.ts` | GET `/api/v1/knowledge/[id]` |
| useUpdateKnowledge | `src/features/knowledge/hooks/useUpdateKnowledge.ts` | PATCH `/api/v1/knowledge/[id]` |

### 2.6 通知フック (Phase 4)

| フック名 | ファイルパス | API |
|---------|-------------|-----|
| useNotifications | `src/features/notifications/hooks/useNotifications.ts` | GET `/api/v1/notifications` |
| useUnreadCount | `src/features/notifications/hooks/useUnreadCount.ts` | GET `/api/v1/notifications/unread-count` |
| useMarkAsRead | `src/features/notifications/hooks/useMarkAsRead.ts` | PATCH `/api/v1/notifications/[id]/read` |

---

## 3. フック設計パターン

### 3.1 データ取得フックパターン

```typescript
function useKnowledgeList(options?: KnowledgeListOptions) {
  const [data, setData] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/v1/knowledge", { params: options });
      setData(response.data.knowledges);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
```

### 3.2 ミューテーションフックパターン

```typescript
function useSendMessage(sessionId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (content: string, action?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(
        `/api/v1/chat/sessions/${sessionId}/messages`,
        { content, action }
      );
      return response.data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return { send, loading, error };
}
```

### 3.3 Zustand Store + API併用パターン

```typescript
// APIから取得したデータをZustand Storeにキャッシュ
function useProfile() {
  const { setProfile } = useUserStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/v1/user/profile").then((res) => {
      if (res.data.data) {
        setProfile(res.data.data); // Storeにキャッシュ
      }
      setLoading(false);
    });
  }, [setProfile]);

  // Storeの値を返す（キャッシュ済み）
  const profile = useUserStore((s) => s.profile);
  return { profile, loading };
}
```

---

## 4. AIサービスとの連携パターン

### チャットフローでのストア連携

```typescript
async function handleSendMessage(text: string) {
  // 1. ユーザーメッセージをストアに追加
  chatStore.addMessage(userMessage);

  // 2. AI サービスを呼び出し
  const response = await sendChatMessage(text, userProfile);

  // 3. AI レスポンスをストアに追加
  chatStore.addMessage(aiMessage);

  // 4. ナレッジ・経験値を更新
  knowledgeStore.addKnowledge(newKnowledge);
  petStore.addExp(earnedExp);
}
```

### AIプロバイダーサービス層

```typescript
// ファクトリパターンでプロバイダーを切り替え
const service = getAISummarizeService();           // 環境変数からプロバイダー決定
const service = getAISummarizeServiceForUser(userConfig); // ユーザー設定から
```

---

## 5. 設計上の考慮点

### パフォーマンス
- ストアのセレクターを活用して不要な再描画を防止
- `persist`ミドルウェアによるlocalStorageアクセスは非同期
- ハイドレーション問題（SSR/CSR不一致）に注意

### エラーハンドリング
- AIサービスのフォールバックレスポンス（`fallback.ts`）
- APIキー未設定時のグレースフルデグレード
- ネットワークエラー時のフォールバック対応

### 型安全性
- 全ストアにTypeScript型定義を付与
- `any`型は禁止、`unknown` + 型ガードで対応
- Prismaの生成型をサービス層で活用

---

## 改訂履歴

| 版数 | 日付 | 内容 | 担当 |
|------|------|------|------|
| 1.0 | 2026-04-02 | 初版作成（docs/から移行） | Claude Code |
| 1.1 | 2026-04-02 | ストアの役割定義（MVP移行方針）セクション追加 | Claude Code |
| 1.2 | 2026-04-02 | 実装との整合性修正: chatStore永続化なし・APIChatMessage型・新アクション反映、userStore/petStoreのsetFromAPI・resetAll追加、knowledgeStoreのsearchKnowledge追加 | Claude Code |
