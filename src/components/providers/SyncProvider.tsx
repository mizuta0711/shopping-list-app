"use client";

import { createContext, memo, useContext, type ReactNode } from "react";
import type { createSyncOrchestrator } from "@/features/sync/services/syncOrchestrator";
import { useInitialMerge } from "@/features/sync/hooks/useInitialMerge";
import { useSyncOnMount } from "@/features/sync/hooks/useSyncOnMount";

type Orchestrator = ReturnType<typeof createSyncOrchestrator>;

const SyncOrchestratorContext = createContext<Orchestrator | null>(null);

export function useSyncOrchestrator(): Orchestrator | null {
  return useContext(SyncOrchestratorContext);
}

function InitialMergeRunner() {
  useInitialMerge();
  return null;
}

type Props = { children: ReactNode };

export const SyncProvider = memo<Props>(function SyncProvider({ children }) {
  const orchestrator = useSyncOnMount();
  return (
    <SyncOrchestratorContext.Provider value={orchestrator}>
      <InitialMergeRunner />
      {children}
    </SyncOrchestratorContext.Provider>
  );
});

SyncProvider.displayName = "SyncProvider";
