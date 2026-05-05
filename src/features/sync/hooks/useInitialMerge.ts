"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useShoppingStore } from "@/features/shopping/stores/shoppingStore";
import { useSetsStore } from "@/features/shopping/stores/setsStore";
import type { ShoppingItem, ShoppingSet } from "@/features/shopping/types";
import { useSyncOrchestrator } from "@/components/providers/SyncProvider";
import { useLocalStorage } from "@/features/sync/hooks/useLocalStorage";
import type { ShoppingItemDTO, ShoppingSetDTO } from "@/types/sync";

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

const setToDTO = (s: ShoppingSet): ShoppingSetDTO => ({
  id: s.id,
  name: s.name,
  items: s.items,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

/**
 * ログイン後の初回マージを実行する。
 * - hasMerged === true なら通常 pull のみ（items + sets 両方）
 * - hasMerged !== true なら mergeOnLogin / mergeSetsOnLogin で全件マージ + サマリートースト
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
    if (!hasMergedHydrated) return;

    if (hasMerged === true) {
      void (async () => {
        await orchestrator.pullOnce();
        await orchestrator.pullSetsOnce();
      })();
      return;
    }

    // 初回マージ: items と sets を並列実行
    void (async () => {
      const localItems = useShoppingStore.getState().items.map(itemToDTO);
      const localSets = useSetsStore.getState().sets.map(setToDTO);
      const [itemsRes, setsRes] = await Promise.all([
        orchestrator.merge(localItems),
        orchestrator.mergeSets(localSets),
      ]);
      // 両方成功した時のみ hasMerged を立てる。片方失敗時は次回ログインで再試行
      if (!itemsRes || !setsRes) return;
      setHasMerged(true);
      const uploaded =
        (itemsRes?.uploadedCount ?? 0) + (setsRes?.uploadedCount ?? 0);
      const downloaded =
        (itemsRes?.downloadedCount ?? 0) + (setsRes?.downloadedCount ?? 0);
      toast.success(
        `ローカルから${uploaded}件をサーバーへ送信、サーバーから${downloaded}件取得しました`,
      );
    })();
  }, [status, userId, hasMerged, hasMergedHydrated, orchestrator, setHasMerged]);
}
