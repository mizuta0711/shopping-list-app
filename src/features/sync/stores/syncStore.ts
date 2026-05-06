import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SyncStatus =
  | "idle"
  | "syncing"
  | "offline"
  | "error"
  | "logged_out";

type SyncState = {
  status: SyncStatus;
  /** 最後に成功した PUT/GET の serverTime */
  lastSyncedAt: string | null;
  /** 次回 GET/PUT の since として送る値（items 用） */
  lastUpdatedAt: string | null;
  /** Phase 10.1b: sets 用の since（items とは別キーで進行） */
  lastSetsUpdatedAt: string | null;
  /** Phase 10.2: lists 用の since */
  lastListsUpdatedAt: string | null;
  /** debounce 中の upsert 対象（items） */
  pendingUpsertIds: Set<string>;
  /** debounce 中の delete 対象（items） */
  pendingDeleteIds: Set<string>;
  /** Phase 10.1b: debounce 中の upsert 対象（sets） */
  pendingSetUpsertIds: Set<string>;
  /** Phase 10.1b: debounce 中の delete 対象（sets） */
  pendingSetDeleteIds: Set<string>;
  /** Phase 10.2: debounce 中の upsert 対象（lists） */
  pendingListUpsertIds: Set<string>;
  /** Phase 10.2: debounce 中の delete 対象（lists） */
  pendingListDeleteIds: Set<string>;
  /** 同期エラー時のメッセージ */
  errorMessage: string | null;
  /** クライアントとサーバーの時刻差 (ms)。発行時の updatedAt 補正に使う */
  clockSkewMs: number;
  /** 上書き発生件数（最後の reconcile 結果を UI 通知するための一時値） */
  lastOverwrittenCount: number;
};

type SyncActions = {
  setStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (time: string) => void;
  setLastUpdatedAt: (time: string | null) => void;
  setLastSetsUpdatedAt: (time: string | null) => void;
  setLastListsUpdatedAt: (time: string | null) => void;
  setClockSkewMs: (skew: number) => void;
  markUpsert: (id: string) => void;
  markDelete: (id: string) => void;
  markSetUpsert: (id: string) => void;
  markSetDelete: (id: string) => void;
  markListUpsert: (id: string) => void;
  markListDelete: (id: string) => void;
  /** 現在の pending を取り出してクリア（items PUT 送信直前に呼ぶ） */
  consumePending: () => { upsertIds: string[]; deleteIds: string[] };
  /** Phase 10.1b: sets PUT 送信直前に呼ぶ */
  consumeSetPending: () => { upsertIds: string[]; deleteIds: string[] };
  /** Phase 10.2: lists PUT 送信直前に呼ぶ */
  consumeListPending: () => { upsertIds: string[]; deleteIds: string[] };
  setError: (message: string | null) => void;
  setOverwrittenCount: (count: number) => void;
  reset: () => void;
};

const initialState: SyncState = {
  status: "logged_out",
  lastSyncedAt: null,
  lastUpdatedAt: null,
  lastSetsUpdatedAt: null,
  lastListsUpdatedAt: null,
  pendingUpsertIds: new Set(),
  pendingDeleteIds: new Set(),
  pendingSetUpsertIds: new Set(),
  pendingSetDeleteIds: new Set(),
  pendingListUpsertIds: new Set(),
  pendingListDeleteIds: new Set(),
  errorMessage: null,
  clockSkewMs: 0,
  lastOverwrittenCount: 0,
};

export const useSyncStore = create<SyncState & SyncActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStatus: (status) => set({ status }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      setLastUpdatedAt: (lastUpdatedAt) => set({ lastUpdatedAt }),
      setLastSetsUpdatedAt: (lastSetsUpdatedAt) => set({ lastSetsUpdatedAt }),
      setLastListsUpdatedAt: (lastListsUpdatedAt) =>
        set({ lastListsUpdatedAt }),
      setClockSkewMs: (clockSkewMs) => set({ clockSkewMs }),

      markUpsert: (id) => {
        set((state) => {
          const upserts = new Set(state.pendingUpsertIds);
          upserts.add(id);
          const deletes = new Set(state.pendingDeleteIds);
          deletes.delete(id);
          return { pendingUpsertIds: upserts, pendingDeleteIds: deletes };
        });
      },

      markDelete: (id) => {
        set((state) => {
          const deletes = new Set(state.pendingDeleteIds);
          deletes.add(id);
          const upserts = new Set(state.pendingUpsertIds);
          upserts.delete(id);
          return { pendingUpsertIds: upserts, pendingDeleteIds: deletes };
        });
      },

      consumePending: () => {
        const upsertIds = Array.from(get().pendingUpsertIds);
        const deleteIds = Array.from(get().pendingDeleteIds);
        set({
          pendingUpsertIds: new Set(),
          pendingDeleteIds: new Set(),
        });
        return { upsertIds, deleteIds };
      },

      markSetUpsert: (id) => {
        set((state) => {
          const upserts = new Set(state.pendingSetUpsertIds);
          upserts.add(id);
          const deletes = new Set(state.pendingSetDeleteIds);
          deletes.delete(id);
          return {
            pendingSetUpsertIds: upserts,
            pendingSetDeleteIds: deletes,
          };
        });
      },

      markSetDelete: (id) => {
        set((state) => {
          const deletes = new Set(state.pendingSetDeleteIds);
          deletes.add(id);
          const upserts = new Set(state.pendingSetUpsertIds);
          upserts.delete(id);
          return {
            pendingSetUpsertIds: upserts,
            pendingSetDeleteIds: deletes,
          };
        });
      },

      consumeSetPending: () => {
        const upsertIds = Array.from(get().pendingSetUpsertIds);
        const deleteIds = Array.from(get().pendingSetDeleteIds);
        set({
          pendingSetUpsertIds: new Set(),
          pendingSetDeleteIds: new Set(),
        });
        return { upsertIds, deleteIds };
      },

      markListUpsert: (id) => {
        set((state) => {
          const upserts = new Set(state.pendingListUpsertIds);
          upserts.add(id);
          const deletes = new Set(state.pendingListDeleteIds);
          deletes.delete(id);
          return {
            pendingListUpsertIds: upserts,
            pendingListDeleteIds: deletes,
          };
        });
      },

      markListDelete: (id) => {
        set((state) => {
          const deletes = new Set(state.pendingListDeleteIds);
          deletes.add(id);
          const upserts = new Set(state.pendingListUpsertIds);
          upserts.delete(id);
          return {
            pendingListUpsertIds: upserts,
            pendingListDeleteIds: deletes,
          };
        });
      },

      consumeListPending: () => {
        const upsertIds = Array.from(get().pendingListUpsertIds);
        const deleteIds = Array.from(get().pendingListDeleteIds);
        set({
          pendingListUpsertIds: new Set(),
          pendingListDeleteIds: new Set(),
        });
        return { upsertIds, deleteIds };
      },

      setError: (errorMessage) => set({ errorMessage }),
      setOverwrittenCount: (lastOverwrittenCount) =>
        set({ lastOverwrittenCount }),

      reset: () => set(initialState),
    }),
    {
      name: "sync-store",
      storage: createJSONStorage(() => localStorage),
      // pendingUpsertIds / pendingDeleteIds は Set 型のため JSON シリアライズ不可。
      // partialize で除外し、起動時に空 Set で再初期化する。
      partialize: (s) => ({
        lastUpdatedAt: s.lastUpdatedAt,
        lastSetsUpdatedAt: s.lastSetsUpdatedAt,
        lastListsUpdatedAt: s.lastListsUpdatedAt,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
);
