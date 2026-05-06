"use client";

import { createContext, memo, useContext, useEffect, type ReactNode } from "react";
import type { createSyncOrchestrator } from "@/features/sync/services/syncOrchestrator";
import { useInitialMerge } from "@/features/sync/hooks/useInitialMerge";
import { useSyncOnMount } from "@/features/sync/hooks/useSyncOnMount";
import { useListsStore } from "@/features/shopping/stores/listsStore";
import { useSetsStore } from "@/features/shopping/stores/setsStore";

type Orchestrator = ReturnType<typeof createSyncOrchestrator>;

const SyncOrchestratorContext = createContext<Orchestrator | null>(null);

export function useSyncOrchestrator(): Orchestrator | null {
  return useContext(SyncOrchestratorContext);
}

function InitialMergeRunner() {
  useInitialMerge();
  return null;
}

/**
 * v1→v2 マイグレーション後補正。
 * listsStore リハイドレート後に listId: "" のセットへ未分類 ID を埋める。
 * migrate コールバック内では listsStore が未初期化のため、ここで遅延補正する。
 */
function SetsListIdRepair() {
  useEffect(() => {
    const repair = () => {
      const unclassifiedId = useListsStore.getState().ensureUnclassified();
      useSetsStore.getState().repairMissingListIds(unclassifiedId);
    };

    // listsStore が既にリハイドレート済みならすぐ実行
    if (useListsStore.persist.hasHydrated()) {
      repair();
      return;
    }

    // まだなら完了コールバックで実行
    const unsub = useListsStore.persist.onFinishHydration(repair);
    return unsub;
  }, []);

  return null;
}

type Props = { children: ReactNode };

export const SyncProvider = memo<Props>(function SyncProvider({ children }) {
  const orchestrator = useSyncOnMount();
  return (
    <SyncOrchestratorContext.Provider value={orchestrator}>
      <SetsListIdRepair />
      <InitialMergeRunner />
      {children}
    </SyncOrchestratorContext.Provider>
  );
});

SyncProvider.displayName = "SyncProvider";
