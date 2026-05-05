"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { createSyncOrchestrator } from "@/features/sync/services/syncOrchestrator";
import { useSyncStore } from "@/features/sync/stores/syncStore";

type Orchestrator = ReturnType<typeof createSyncOrchestrator>;

export function useSyncOnMount(): {
  orchestrator: Orchestrator | null;
} {
  const { status } = useSession();
  const orchestratorRef = useRef<Orchestrator | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // ログアウト時は orchestrator 停止 + 状態リセット
      orchestratorRef.current?.stop();
      orchestratorRef.current = null;
      useSyncStore.getState().setStatus("logged_out");
      return;
    }

    // 認証済み: orchestrator 起動 + 初回 pull
    if (!orchestratorRef.current) {
      const o = createSyncOrchestrator();
      o.start();
      orchestratorRef.current = o;
      void o.pullOnce();
    }

    return () => {
      // HMR 時に古い購読を確実に解除
      orchestratorRef.current?.stop();
      orchestratorRef.current = null;
    };
  }, [status]);

  return { orchestrator: orchestratorRef.current };
}
