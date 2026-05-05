"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useShoppingStore } from "@/features/shopping/stores/shoppingStore";
import type { ShoppingItem } from "@/features/shopping/types";
import { useSyncOrchestrator } from "@/components/providers/SyncProvider";
import { useLocalStorage } from "@/features/sync/hooks/useLocalStorage";
import type { ShoppingItemDTO } from "@/types/sync";

const HAS_MERGED_KEY = (userId: string) => `sync:hasMerged:${userId}`;

const itemToDTO = (item: ShoppingItem): ShoppingItemDTO => ({
  id: item.id,
  name: item.name,
  scope: item.scope,
  status: item.status,
  order: item.order,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  purchasedAt: item.purchasedAt,
});

/**
 * ログイン後の初回マージを実行する。
 * - hasMerged === true なら通常 pull のみ
 * - hasMerged !== true なら mergeOnLogin で全件マージ + サマリートースト
 *
 * hasMerged フラグは LocalStorage に `sync:hasMerged:${userId}` で保存。
 * ユーザー単位に分離して、ログアウト時には AccountSection 側で削除する。
 */
export function useInitialMerge() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const orchestrator = useSyncOrchestrator();
  const [hasMerged, setHasMerged, hasMergedHydrated] = useLocalStorage<boolean>(
    userId ? HAS_MERGED_KEY(userId) : null,
    false,
  );

  useEffect(() => {
    if (status !== "authenticated" || !userId || !orchestrator) return;
    // localStorage の水和完了を待ってから分岐判定する（未水和のまま merge を発火させない）
    if (!hasMergedHydrated) return;

    if (hasMerged === true) {
      // マージ済み → 通常の差分取得
      void orchestrator.pullOnce();
      return;
    }

    // 初回マージ
    void (async () => {
      const localItems = useShoppingStore
        .getState()
        .items.map(itemToDTO);
      const res = await orchestrator.merge(localItems);
      if (!res) return;
      setHasMerged(true);
      toast.success(
        `ローカルから${res.uploadedCount}件をサーバーへ送信、サーバーから${res.downloadedCount}件取得しました`,
      );
    })();
  }, [status, userId, hasMerged, hasMergedHydrated, orchestrator, setHasMerged]);
}
