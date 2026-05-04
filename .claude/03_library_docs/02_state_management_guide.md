# 状態管理ガイド

## Zustand 5 ストア設計

### 設計原則

1. **機能別分離** — 各機能ドメインに独立ストアを作成
2. **localStorage永続化** — `persist` ミドルウェア使用（chatStoreを除く）
3. **不変性維持** — 配列は常に新しい参照を作成（スプレッド演算子等）
4. **型安全性** — `any` 型完全禁止

### ストア一覧

| ストア | ファイルパス | persistキー | 主要状態 | 主要アクション |
|---|---|---|---|---|
| `useUserStore` | `src/features/onboarding/stores/userStore.ts` | `skillup-user` | name, petName, specialties, technologies, experienceYears, currentProject, onboardingCompleted | setProfile, completeOnboarding, setFromAPI, resetAll |
| `useChatStore` | `src/features/chat/stores/chatStore.ts` | **なし（永続化なし）** | currentSessionId, messages (APIChatMessage[]), isSending | setCurrentSession, addMessage, addMessages, setIsSending, clearSession, resetAll |
| `usePetStore` | `src/features/pet/stores/petStore.ts` | `skillup-pet` | name, level, exp, expToNext, stage | setName, addExp, setFromAPI, resetAll |
| `useKnowledgeStore` | `src/features/knowledge/stores/knowledgeStore.ts` | `skillup-knowledge` | knowledgeList | addKnowledge, updateStatus, getByCategory, getById, searchKnowledge, resetAll |

### ストア実装パターン

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExampleState {
  items: Item[];
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
}

export const useExampleStore = create<ExampleState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => ({
        items: [...state.items, item],
      })),
      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),
    }),
    { name: 'example-store' }
  )
);
```

## MVP での変更

ストアはAPIキャッシュとして残す。APIから取得したデータをZustandに保存し、UIはストアから読む。

- クライアント → API呼び出し → レスポンスをストアに保存 → UIはストアから描画

## ストア設計方針（APIキャッシュ vs ローカルステート）

### MVP移行期の方針

モック時代は全てのデータをZustandストアで管理していたが、MVP移行に伴いストアの役割を**APIデータのキャッシュ**に限定する。

### ストアに入れるもの（APIキャッシュ）

| 種類 | 例 | 理由 |
|------|-----|------|
| APIから取得したエンティティデータ | ユーザープロフィール、ペット情報、ナレッジ一覧 | 複数コンポーネントから参照される |
| セッション状態 | currentSessionId | 画面遷移をまたいで保持が必要 |
| 永続化が必要なデータ | ユーザー設定、ペット状態 | localStorage経由で再訪問時に復元 |

### ストアに入れないもの（ローカルステート: useState）

| 種類 | 例 | 理由 |
|------|-----|------|
| UIの一時的な状態 | モーダルの開閉、フォームの入力値、アコーディオンの開閉 | コンポーネントのライフサイクルに紐づく |
| ローディング状態 | 個別APIのローディング | 各フックで管理すべき（ただし `isSending` のようにUX上重要なものは例外） |
| エラー状態 | API呼び出しのエラー | 各フックで管理 |
| 派生データ | カテゴリ別グルーピング結果 | ストアのアクション（getByCategory等）で都度計算 |

### 例外ルール

`chatStore.isSending` のように、**複数コンポーネントから参照されるUIステート**はストアに入れてよい。判断基準:

1. 2つ以上のコンポーネントから参照されるか？ → Yes ならストア
2. 画面遷移後も保持が必要か？ → Yes ならストア
3. 上記どちらも No → useState で十分

### chatStore の特殊性

chatStore は**永続化なし**（persist未使用）。理由:
- メッセージデータはDBに保存されており、APIから再取得可能
- セッション切り替え時にリセットされるため、localStorage保存の意味がない
- `isSending` はUIステートだが、ChatInputとChatBubble両方から参照されるためストアに含む

## チャットフローでのストア連携

1. ユーザーメッセージ → `chatStore` に追加
2. AI Service 呼び出し（API経由）
3. AI レスポンス → `chatStore` に追加
4. ナレッジ獲得 → `knowledgeStore` 更新
5. 経験値獲得 → `petStore` 更新

## パフォーマンス考慮

### ストアセレクター

不要な再レンダリングを防止するため、必要な値のみ選択する。

```typescript
// 推奨: セレクターで必要な値のみ取得
const petName = usePetStore((state) => state.name);
const petLevel = usePetStore((state) => state.level);

// 非推奨: ストア全体を取得
const petStore = usePetStore();
```

### ハイドレーション問題

SSR/CSR の不一致に注意。localStorage から復元される値は、サーバーサイドレンダリング時に存在しないため、初期値との差異が発生する可能性がある。

対策:
- `useEffect` 内でストアの値を参照
- ハイドレーション完了後にUIを切り替え

## 改訂履歴

| 版数 | 日付 | 内容 | 担当 |
|------|------|------|------|
| 1.0 | 2026-04-02 | 初版作成（テンプレート適用） | Claude Code |
| 1.1 | 2026-04-02 | ストア設計方針（APIキャッシュ vs ローカルステート）セクション追加 | Claude Code |
| 1.2 | 2026-04-02 | 実装との整合性修正: ストア一覧テーブルの状態・アクションを実装の実態に合わせて更新（chatStore永続化なし、userStore/petStoreのsetFromAPI・resetAll、knowledgeStoreのsearchKnowledge追加） | Claude Code |
