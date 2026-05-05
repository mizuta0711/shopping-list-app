"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { createSyncOrchestrator } from "@/features/sync/services/syncOrchestrator";
import { useSyncStore } from "@/features/sync/stores/syncStore";

type Orchestrator = ReturnType<typeof createSyncOrchestrator>;

/**
 * セッション状態に応じて orchestrator を起動/停止し、
 * 起動中のインスタンスを state として返す。SyncProvider から context に流す。
 */
export function useSyncOnMount(): Orchestrator | null {
  const { status } = useSession();
  const [orchestrator, setOrchestrator] = useState<Orchestrator | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      useSyncStore.getState().setStatus("logged_out");
      return;
    }

    const o = createSyncOrchestrator();
    o.start();
    setOrchestrator(o);
    // 初回 pull / merge は useInitialMerge が担当（hasMerged フラグで分岐）

    return () => {
      o.stop();
      setOrchestrator(null);
    };
  }, [status]);

  return orchestrator;
}
