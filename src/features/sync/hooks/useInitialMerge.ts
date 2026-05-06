"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useListsStore } from "@/features/shopping/stores/listsStore";
import { useShoppingStore } from "@/features/shopping/stores/shoppingStore";
import { useSetsStore } from "@/features/shopping/stores/setsStore";
import type {
  ShoppingItem,
  ShoppingList,
  ShoppingSet,
} from "@/features/shopping/types";
import { useSyncOrchestrator } from "@/components/providers/SyncProvider";
import { useLocalStorage } from "@/features/sync/hooks/useLocalStorage";
import type {
  ShoppingItemDTO,
  ShoppingListDTO,
  ShoppingSetDTO,
} from "@/types/sync";

const HAS_MERGED_KEY = (userId: string) => `sync:hasMerged:${userId}`;

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

const listToDTO = (l: ShoppingList): ShoppingListDTO => ({
  id: l.id,
  name: l.name,
  emoji: l.emoji,
  system: l.system,
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
});

/**
 * ログイン後の初回マージを実行する。
 * Phase 10.2: lists を先行直列マージ → items / sets を並列マージの 2 フェーズ。
 * lists で確定した unclassifiedId と remappedUnclassifiedIds を items のリマップに使うため、
 * 並列実行ではなく直列依存にする。
 *
 * - hasMerged === true なら通常 pull のみ（lists + items + sets）
 * - hasMerged !== true なら lists merge → items/sets merge をフルで実行 + サマリートースト
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
        await orchestrator.pullListsOnce();
        await orchestrator.pullOnce();
        await orchestrator.pullSetsOnce();
      })();
      return;
    }

    // 初回マージ: lists 先行 → items + sets 並列
    void (async () => {
      // 1. lists merge を先に実行
      const localLists = useListsStore.getState().lists.map(listToDTO);
      const localUnclassifiedId =
        useListsStore.getState().lists.find((l) => l.system)?.id ?? null;
      const listsRes = await orchestrator.mergeLists(
        localLists,
        localUnclassifiedId,
      );
      if (!listsRes) return;

      // 2. クライアント側 listId remap（未分類が複数存在する場合）
      if (listsRes.remappedUnclassifiedIds.length > 0) {
        useShoppingStore
          .getState()
          .remapListIds(
            listsRes.remappedUnclassifiedIds,
            listsRes.unclassifiedId,
          );
        // Phase 10.4: sets の listId も同様にリマップ（C3 対応）
        const remappedRecord = Object.fromEntries(
          listsRes.remappedUnclassifiedIds.map((fromId) => [
            fromId,
            listsRes.unclassifiedId,
          ]),
        );
        useSetsStore.getState().remapListIds(remappedRecord);
      }

      // 3. items / sets を並列マージ（remap 済みの listId で）
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
        (listsRes?.uploadedCount ?? 0) +
        (itemsRes?.uploadedCount ?? 0) +
        (setsRes?.uploadedCount ?? 0);
      const downloaded =
        (listsRes?.downloadedCount ?? 0) +
        (itemsRes?.downloadedCount ?? 0) +
        (setsRes?.downloadedCount ?? 0);
      toast.success(
        `ローカルから${uploaded}件をサーバーへ送信、サーバーから${downloaded}件取得しました`,
      );
    })();
  }, [status, userId, hasMerged, hasMergedHydrated, orchestrator, setHasMerged]);
}
