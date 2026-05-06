"use client";

import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { useActiveListStore } from "@/features/shopping/stores/activeListStore";
import { useListsStore } from "@/features/shopping/stores/listsStore";
import { useShoppingStore } from "@/features/shopping/stores/shoppingStore";
import { useSetsStore } from "@/features/shopping/stores/setsStore";
import type {
  ShoppingItem,
  ShoppingList,
  ShoppingSet,
} from "@/features/shopping/types";
import { useSyncStore } from "@/features/sync/stores/syncStore";
import {
  reconcile,
  reconcileLists,
  reconcileSets,
} from "@/features/sync/services/reconcile";
import { HttpError, syncClient } from "@/features/sync/services/syncClient";
import type {
  ListsSyncMergeResponse,
  SetsSyncMergeResponse,
  ShoppingItemDTO,
  ShoppingListDTO,
  ShoppingSetDTO,
  SyncMergeResponse,
} from "@/types/sync";

const DEBOUNCE_MS = 1500;
const FOCUS_PULL_THROTTLE_MS = 60_000;

const itemToDTO = (item: ShoppingItem): ShoppingItemDTO => ({
  id: item.id,
  listId: item.listId,
  name: item.name,
  scope: item.scope,
  status: item.status,
  order: item.order,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  purchasedAt: item.purchasedAt,
});

const setToDTO = (s: ShoppingSet): ShoppingSetDTO => ({
  id: s.id,
  listId: s.listId,
  name: s.name,
  items: s.items,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

const listToDTOClient = (l: ShoppingList): ShoppingListDTO => ({
  id: l.id,
  name: l.name,
  emoji: l.emoji,
  system: l.system,
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
});

type Orchestrator = {
  start: () => void;
  stop: () => void;
  pullOnce: () => Promise<void>;
  pushPendingNow: () => Promise<void>;
  retry: () => Promise<void>;
  merge: (localItems: ShoppingItemDTO[]) => Promise<SyncMergeResponse | null>;
  // Phase 10.1b: sets 同期
  pullSetsOnce: () => Promise<void>;
  pushPendingSetsNow: () => Promise<void>;
  mergeSets: (
    localSets: ShoppingSetDTO[],
  ) => Promise<SetsSyncMergeResponse | null>;
  // Phase 10.2: lists 同期
  pullListsOnce: () => Promise<void>;
  pushPendingListsNow: () => Promise<void>;
  mergeLists: (
    localLists: ShoppingListDTO[],
    localUnclassifiedId: string | null,
  ) => Promise<ListsSyncMergeResponse | null>;
};

const noop: Orchestrator = {
  start: () => {},
  stop: () => {},
  pullOnce: async () => {},
  pushPendingNow: async () => {},
  retry: async () => {},
  merge: async () => null,
  pullSetsOnce: async () => {},
  pushPendingSetsNow: async () => {},
  mergeSets: async () => null,
  pullListsOnce: async () => {},
  pushPendingListsNow: async () => {},
  mergeLists: async () => null,
};

export function createSyncOrchestrator(): Orchestrator {
  if (typeof window === "undefined") return noop;

  let prevSnapshot: ShoppingItem[] = useShoppingStore.getState().items;
  let prevSetsSnapshot: ShoppingSet[] = useSetsStore.getState().sets;
  let prevListsSnapshot: ShoppingList[] = useListsStore.getState().lists;
  let unsubscribe: (() => void) | null = null;
  let unsubscribeSets: (() => void) | null = null;
  let unsubscribeLists: (() => void) | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let setsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let listsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;
  let setsAbortController: AbortController | null = null;
  let listsAbortController: AbortController | null = null;
  let lastFocusPullAt = 0;

  const updateClockSkew = (serverTime: string) => {
    const skew = Date.now() - new Date(serverTime).getTime();
    useSyncStore.getState().setClockSkewMs(skew);
  };

  const setSyncing = () => {
    if (!navigator.onLine) {
      useSyncStore.getState().setStatus("offline");
      return;
    }
    useSyncStore.getState().setStatus("syncing");
  };

  const setIdle = () => {
    useSyncStore.getState().setStatus("idle");
    useSyncStore.getState().setError(null);
  };

  const handleError = (e: unknown) => {
    if (e instanceof DOMException && e.name === "AbortError") return;
    if (e instanceof HttpError && e.status === 401) {
      useSyncStore.getState().setStatus("logged_out");
      void signOut({ redirect: false });
      return;
    }
    useSyncStore.getState().setStatus("error");
    const message = e instanceof Error ? e.message : "同期に失敗しました";
    useSyncStore.getState().setError(message);
  };

  const pullOnce = async (): Promise<void> => {
    abortController?.abort();
    abortController = new AbortController();
    setSyncing();
    try {
      const since = useSyncStore.getState().lastUpdatedAt;
      const res = await syncClient.pull({ since }, abortController.signal);
      updateClockSkew(res.serverTime);

      // serverDeletes と items を applyServerChanges で反映
      useShoppingStore.getState().applyServerChanges({
        upserts: res.items as ShoppingItem[],
        deletes: res.serverDeletes,
      });

      // snapshot 更新（subscribe での誤検知を防ぐ）
      prevSnapshot = useShoppingStore.getState().items;

      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);
      setIdle();
    } catch (e) {
      handleError(e);
    }
  };

  const pushPendingNow = async (): Promise<void> => {
    const { upsertIds, deleteIds } = useSyncStore.getState().consumePending();
    if (upsertIds.length === 0 && deleteIds.length === 0) return;

    abortController?.abort();
    abortController = new AbortController();
    setSyncing();

    try {
      const items = useShoppingStore.getState().items;
      const itemsById = new Map(items.map((i) => [i.id, i]));
      const upserts = upsertIds
        .map((id) => itemsById.get(id))
        .filter((i): i is ShoppingItem => i !== undefined)
        .map(itemToDTO);

      const since = useSyncStore.getState().lastUpdatedAt;
      const res = await syncClient.push(
        { upserts, deletedIds: deleteIds, since },
        abortController.signal,
      );
      updateClockSkew(res.serverTime);

      // reconcile して shoppingStore に反映
      const local = useShoppingStore.getState().items;
      const { next, overwrittenCount } = reconcile({
        local,
        serverChanges: res.serverChanges,
        serverDeletes: res.serverDeletes,
        rejected: res.rejected,
      });
      useShoppingStore.getState().setItems(next);
      prevSnapshot = next;

      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);

      if (overwrittenCount > 0) {
        // 既存トーストとの重なりを避けるため少し遅延
        setTimeout(() => {
          toast.message(
            `別端末の更新で${overwrittenCount}件が最新版に置き換わりました`,
          );
        }, 200);
        useSyncStore.getState().setOverwrittenCount(overwrittenCount);
      }

      setIdle();
    } catch (e) {
      handleError(e);
    }
  };

  const scheduleDebouncedPush = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void pushPendingNow();
    }, DEBOUNCE_MS);
  };

  const onStoreChange = (state: ReturnType<typeof useShoppingStore.getState>) => {
    const next = state.items;
    const prev = prevSnapshot;
    if (next === prev) return;
    const prevById = new Map(prev.map((i) => [i.id, i]));
    const nextById = new Map(next.map((i) => [i.id, i]));

    let changed = false;
    for (const item of next) {
      const before = prevById.get(item.id);
      if (!before || before.updatedAt !== item.updatedAt) {
        useSyncStore.getState().markUpsert(item.id);
        changed = true;
      }
    }
    for (const item of prev) {
      if (!nextById.has(item.id)) {
        useSyncStore.getState().markDelete(item.id);
        changed = true;
      }
    }

    prevSnapshot = next;
    if (changed) scheduleDebouncedPush();
  };

  const onOnline = () => {
    void (async () => {
      await pullListsOnce();
      await pushPendingListsNow();
      await pullOnce();
      await pushPendingNow();
      await pullSetsOnce();
      await pushPendingSetsNow();
    })();
  };

  const onOffline = () => {
    useSyncStore.getState().setStatus("offline");
  };

  const onFocus = () => {
    const now = Date.now();
    if (now - lastFocusPullAt < FOCUS_PULL_THROTTLE_MS) return;
    lastFocusPullAt = now;
    void (async () => {
      await pullListsOnce();
      await pullOnce();
      await pullSetsOnce();
    })();
  };

  // ---------- Phase 10.1b: sets ----------

  const pullSetsOnce = async (): Promise<void> => {
    setsAbortController?.abort();
    setsAbortController = new AbortController();
    setSyncing();
    try {
      const since = useSyncStore.getState().lastSetsUpdatedAt;
      const res = await syncClient.pullSets(
        { since },
        setsAbortController.signal,
      );
      updateClockSkew(res.serverTime);
      useSetsStore.getState().applyServerChanges({
        upserts: res.sets,
        deletes: res.serverDeletes,
      });
      prevSetsSnapshot = useSetsStore.getState().sets;
      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastSetsUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);
      setIdle();
    } catch (e) {
      handleError(e);
    }
  };

  const pushPendingSetsNow = async (): Promise<void> => {
    const { upsertIds, deleteIds } = useSyncStore
      .getState()
      .consumeSetPending();
    if (upsertIds.length === 0 && deleteIds.length === 0) return;

    setsAbortController?.abort();
    setsAbortController = new AbortController();
    setSyncing();

    try {
      const sets = useSetsStore.getState().sets;
      const setsById = new Map(sets.map((s) => [s.id, s]));
      const upserts = upsertIds
        .map((id) => setsById.get(id))
        .filter((s): s is ShoppingSet => s !== undefined)
        .map(setToDTO);

      const since = useSyncStore.getState().lastSetsUpdatedAt;
      const res = await syncClient.pushSets(
        { upserts, deletedIds: deleteIds, since },
        setsAbortController.signal,
      );
      updateClockSkew(res.serverTime);

      const local = useSetsStore.getState().sets;
      const { next, overwrittenCount } = reconcileSets({
        local,
        serverChanges: res.serverChanges,
        serverDeletes: res.serverDeletes,
        rejected: res.rejected,
      });
      useSetsStore.getState().setSets(next);
      prevSetsSnapshot = next;

      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastSetsUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);

      if (overwrittenCount > 0) {
        setTimeout(() => {
          toast.message(
            `別端末の更新で${overwrittenCount}件のセットが最新版に置き換わりました`,
          );
        }, 200);
      }

      setIdle();
    } catch (e) {
      handleError(e);
    }
  };

  const scheduleSetsDebouncedPush = () => {
    if (setsDebounceTimer) clearTimeout(setsDebounceTimer);
    setsDebounceTimer = setTimeout(() => {
      void pushPendingSetsNow();
    }, DEBOUNCE_MS);
  };

  const onSetsStoreChange = (
    state: ReturnType<typeof useSetsStore.getState>,
  ) => {
    const next = state.sets;
    const prev = prevSetsSnapshot;
    if (next === prev) return;
    const prevById = new Map(prev.map((s) => [s.id, s]));
    const nextById = new Map(next.map((s) => [s.id, s]));

    let changed = false;
    for (const s of next) {
      const before = prevById.get(s.id);
      if (!before || before.updatedAt !== s.updatedAt) {
        useSyncStore.getState().markSetUpsert(s.id);
        changed = true;
      }
    }
    for (const s of prev) {
      if (!nextById.has(s.id)) {
        useSyncStore.getState().markSetDelete(s.id);
        changed = true;
      }
    }

    prevSetsSnapshot = next;
    if (changed) scheduleSetsDebouncedPush();
  };

  const mergeSets = async (
    localSets: ShoppingSetDTO[],
  ): Promise<SetsSyncMergeResponse | null> => {
    setsAbortController?.abort();
    setsAbortController = new AbortController();
    setSyncing();
    try {
      const res = await syncClient.mergeSetsOnLogin(
        { localSets },
        setsAbortController.signal,
      );
      updateClockSkew(res.serverTime);
      useSetsStore.getState().setSets(res.finalSets);
      prevSetsSnapshot = useSetsStore.getState().sets;
      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastSetsUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);
      setIdle();
      return res;
    } catch (e) {
      handleError(e);
      return null;
    }
  };

  // ---------- Phase 10.2: lists ----------

  const ensureActiveListIsValid = () => {
    const lists = useListsStore.getState().lists;
    const validIds = new Set(lists.map((l) => l.id));
    const activeId = useActiveListStore.getState().activeListId;
    if (activeId && !validIds.has(activeId)) {
      const unclassifiedId = useListsStore.getState().ensureUnclassified();
      useActiveListStore.getState().setActiveListId(unclassifiedId);
    }
  };

  const pullListsOnce = async (): Promise<void> => {
    listsAbortController?.abort();
    listsAbortController = new AbortController();
    setSyncing();
    try {
      const since = useSyncStore.getState().lastListsUpdatedAt;
      const res = await syncClient.pullLists(
        { since },
        listsAbortController.signal,
      );
      updateClockSkew(res.serverTime);
      useListsStore.getState().applyServerChanges({
        upserts: res.lists,
        deletes: res.serverDeletes,
      });
      prevListsSnapshot = useListsStore.getState().lists;
      // server で削除されたリスト所属アイテムの listId を未分類へ連鎖更新
      // (server 側で既に未分類化済みだが、次の items pull まで listId が古いため、
      //  クライアント側でも先回りして整合性を保つ)
      if (res.serverDeletes.length > 0) {
        const unclassifiedId = useListsStore.getState().ensureUnclassified();
        for (const id of res.serverDeletes) {
          useShoppingStore.getState().applyListDeleted(id, unclassifiedId);
        }
      }
      ensureActiveListIsValid();
      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastListsUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);
      setIdle();
    } catch (e) {
      handleError(e);
    }
  };

  const pushPendingListsNow = async (): Promise<void> => {
    const { upsertIds, deleteIds } = useSyncStore
      .getState()
      .consumeListPending();
    if (upsertIds.length === 0 && deleteIds.length === 0) return;

    listsAbortController?.abort();
    listsAbortController = new AbortController();
    setSyncing();

    try {
      const lists = useListsStore.getState().lists;
      const listsById = new Map(lists.map((l) => [l.id, l]));
      const upserts = upsertIds
        .map((id) => listsById.get(id))
        .filter((l): l is ShoppingList => l !== undefined && !l.system)
        .map(listToDTOClient);

      const since = useSyncStore.getState().lastListsUpdatedAt;
      const res = await syncClient.pushLists(
        { upserts, deletedIds: deleteIds, since },
        listsAbortController.signal,
      );
      updateClockSkew(res.serverTime);

      const local = useListsStore.getState().lists;
      const { next, overwrittenCount } = reconcileLists({
        local,
        serverChanges: res.serverChanges,
        serverDeletes: res.serverDeletes,
        rejected: res.rejected,
      });
      useListsStore.getState().setLists(next);
      prevListsSnapshot = next;
      ensureActiveListIsValid();

      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastListsUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);

      if (overwrittenCount > 0) {
        setTimeout(() => {
          toast.message(
            `別端末の更新で${overwrittenCount}件のリストが最新版に置き換わりました`,
          );
        }, 200);
      }

      setIdle();
    } catch (e) {
      handleError(e);
    }
  };

  const scheduleListsDebouncedPush = () => {
    if (listsDebounceTimer) clearTimeout(listsDebounceTimer);
    listsDebounceTimer = setTimeout(() => {
      void pushPendingListsNow();
    }, DEBOUNCE_MS);
  };

  const onListsStoreChange = (
    state: ReturnType<typeof useListsStore.getState>,
  ) => {
    const next = state.lists;
    const prev = prevListsSnapshot;
    if (next === prev) return;
    const prevById = new Map(prev.map((l) => [l.id, l]));
    const nextById = new Map(next.map((l) => [l.id, l]));

    let changed = false;
    for (const l of next) {
      if (l.system) continue; // system list は同期しない
      const before = prevById.get(l.id);
      if (!before || before.updatedAt !== l.updatedAt) {
        useSyncStore.getState().markListUpsert(l.id);
        changed = true;
      }
    }
    for (const l of prev) {
      if (l.system) continue;
      if (!nextById.has(l.id)) {
        useSyncStore.getState().markListDelete(l.id);
        changed = true;
      }
    }

    prevListsSnapshot = next;
    if (changed) scheduleListsDebouncedPush();
  };

  const mergeLists = async (
    localLists: ShoppingListDTO[],
    localUnclassifiedId: string | null,
  ): Promise<ListsSyncMergeResponse | null> => {
    listsAbortController?.abort();
    listsAbortController = new AbortController();
    setSyncing();
    try {
      const res = await syncClient.mergeListsOnLogin(
        { localLists, localUnclassifiedId },
        listsAbortController.signal,
      );
      updateClockSkew(res.serverTime);
      useListsStore.getState().setLists(res.finalLists);
      prevListsSnapshot = useListsStore.getState().lists;
      ensureActiveListIsValid();
      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastListsUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);
      setIdle();
      return res;
    } catch (e) {
      handleError(e);
      return null;
    }
  };

  const merge = async (
    localItems: ShoppingItemDTO[],
  ): Promise<SyncMergeResponse | null> => {
    abortController?.abort();
    abortController = new AbortController();
    setSyncing();
    try {
      const res = await syncClient.mergeOnLogin(
        { localItems },
        abortController.signal,
      );
      updateClockSkew(res.serverTime);
      useShoppingStore.getState().setItems(res.finalItems as ShoppingItem[]);
      prevSnapshot = useShoppingStore.getState().items;
      if (res.lastUpdatedAt) {
        useSyncStore.getState().setLastUpdatedAt(res.lastUpdatedAt);
      }
      useSyncStore.getState().setLastSyncedAt(res.serverTime);
      setIdle();
      return res;
    } catch (e) {
      handleError(e);
      return null;
    }
  };

  return {
    start: () => {
      if (unsubscribe) return; // 二重 start 防止
      prevSnapshot = useShoppingStore.getState().items;
      prevSetsSnapshot = useSetsStore.getState().sets;
      prevListsSnapshot = useListsStore.getState().lists;
      unsubscribe = useShoppingStore.subscribe(onStoreChange);
      unsubscribeSets = useSetsStore.subscribe(onSetsStoreChange);
      unsubscribeLists = useListsStore.subscribe(onListsStoreChange);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      window.addEventListener("focus", onFocus);
      // 初期状態の反映
      if (!navigator.onLine) {
        useSyncStore.getState().setStatus("offline");
      }
    },
    stop: () => {
      unsubscribe?.();
      unsubscribe = null;
      unsubscribeSets?.();
      unsubscribeSets = null;
      unsubscribeLists?.();
      unsubscribeLists = null;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      if (setsDebounceTimer) clearTimeout(setsDebounceTimer);
      setsDebounceTimer = null;
      if (listsDebounceTimer) clearTimeout(listsDebounceTimer);
      listsDebounceTimer = null;
      abortController?.abort();
      abortController = null;
      setsAbortController?.abort();
      setsAbortController = null;
      listsAbortController?.abort();
      listsAbortController = null;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
    },
    pullOnce,
    pushPendingNow,
    retry: async () => {
      await pullListsOnce();
      await pushPendingListsNow();
      await pullOnce();
      await pushPendingNow();
      await pullSetsOnce();
      await pushPendingSetsNow();
    },
    merge,
    pullSetsOnce,
    pushPendingSetsNow,
    mergeSets,
    pullListsOnce,
    pushPendingListsNow,
    mergeLists,
  };
}
