"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { History, RefreshCw, Settings, ShoppingCart } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useShoppingStore } from "../stores/shoppingStore";
import { filterPendingByScope, sortItems } from "../stores/selectors";
import type { ItemScope, ShoppingItem } from "../types";
import { SortableItemRow } from "./SortableItemRow";
import { AddItemForm } from "./AddItemForm";
import { ScopeTabs } from "./ScopeTabs";
import { SortMenu } from "./SortMenu";
import { OnboardingModal } from "./OnboardingModal";

export function ShoppingMainView() {
  const [hydrated, setHydrated] = useState(false);
  const [activeScope, setActiveScope] = useState<ItemScope>("TODAY");
  // セッション中だけ表示しておく購入済みアイテムの ID 集合（誤タップ救済用）
  const [keptPurchasedIds, setKeptPurchasedIds] = useState<string[]>([]);

  useEffect(() => {
    setHydrated(useShoppingStore.persist.hasHydrated());
    const unsub = useShoppingStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  const items = useShoppingStore((state) => state.items);
  const sort = useShoppingStore((state) => state.sort);
  const hasOnboarded = useShoppingStore((state) => state.hasOnboarded);
  const togglePurchased = useShoppingStore((state) => state.togglePurchased);
  const moveScope = useShoppingStore((state) => state.moveScope);
  const setSort = useShoppingStore((state) => state.setSort);
  const reorderItems = useShoppingStore((state) => state.reorderItems);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const todayCount = useMemo(
    () => filterPendingByScope(items, "TODAY").length,
    [items],
  );
  const laterCount = useMemo(
    () => filterPendingByScope(items, "LATER").length,
    [items],
  );

  const visibleItems = useMemo<ShoppingItem[]>(() => {
    // 元の位置を維持するため、PENDING と「保持中の PURCHASED」を1つの配列でまとめてからソート
    const filtered = items.filter(
      (i) =>
        i.scope === activeScope &&
        (i.status === "PENDING" ||
          (i.status === "PURCHASED" && keptPurchasedIds.includes(i.id))),
    );
    return sortItems(filtered, sort);
  }, [items, activeScope, sort, keptPurchasedIds]);

  const keptCountThisScope = useMemo(
    () =>
      items.filter(
        (i) =>
          i.scope === activeScope &&
          i.status === "PURCHASED" &&
          keptPurchasedIds.includes(i.id),
      ).length,
    [items, activeScope, keptPurchasedIds],
  );

  const handleToggle = useCallback(
    (id: string) => {
      const target = items.find((i) => i.id === id);
      if (!target) return;
      togglePurchased(id);
      if (target.status === "PENDING") {
        // PENDING → PURCHASED: セッション保持リストに追加
        setKeptPurchasedIds((prev) =>
          prev.includes(id) ? prev : [...prev, id],
        );
      } else {
        // PURCHASED → PENDING: 保持リストから外す
        setKeptPurchasedIds((prev) => prev.filter((x) => x !== id));
      }
    },
    [items, togglePurchased],
  );

  const handleMoveScope = useCallback(
    (id: string, targetScope: ItemScope) => moveScope(id, targetScope),
    [moveScope],
  );

  const handleRefresh = useCallback(() => {
    setKeptPurchasedIds([]);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = visibleItems.findIndex((i) => i.id === active.id);
      const newIndex = visibleItems.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const moved = arrayMove(visibleItems, oldIndex, newIndex);
      // PENDING のみで再採番（PURCHASED は次の更新で消えるため触らない）
      const orderedPendingIds = moved
        .filter((i) => i.status === "PENDING")
        .map((i) => i.id);
      if (orderedPendingIds.length === 0) return;
      if (sort !== "MANUAL") setSort("MANUAL");
      reorderItems(activeScope, orderedPendingIds);
    },
    [visibleItems, sort, setSort, reorderItems, activeScope],
  );

  const sortableIds = useMemo(
    () => visibleItems.map((i) => i.id),
    [visibleItems],
  );

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-gray-200 bg-white px-3 py-3">
        <ShoppingCart className="ml-1 h-5 w-5 text-gray-900" aria-hidden />
        <h1 className="ml-1 flex-1 text-lg font-bold text-gray-900">
          買い物リスト
        </h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={keptCountThisScope === 0}
          aria-label="購入済みアイテムをリストから消す"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
        >
          <RefreshCw className="h-5 w-5" aria-hidden />
          {keptCountThisScope > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
              {keptCountThisScope}
            </span>
          )}
        </button>
        <SortMenu active={sort} onChange={setSort} />
        <Link
          href="/history"
          aria-label="購入済み履歴を開く"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <History className="h-5 w-5" aria-hidden />
        </Link>
        <Link
          href="/settings"
          aria-label="設定を開く"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <ScopeTabs
        active={activeScope}
        todayCount={todayCount}
        laterCount={laterCount}
        onChange={setActiveScope}
      />

      <div className="flex-1 overflow-y-auto">
        {!hydrated ? (
          <SkeletonList />
        ) : visibleItems.length === 0 ? (
          <EmptyState scope={activeScope} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              <ul>
                {visibleItems.map((item) => (
                  <li key={item.id}>
                    <SortableItemRow
                      item={item}
                      onToggle={handleToggle}
                      onMoveScope={handleMoveScope}
                    />
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white">
        <AddItemForm scope={activeScope} />
      </div>

      {hydrated && !hasOnboarded && <OnboardingModal />}
    </main>
  );
}

function SkeletonList() {
  return (
    <ul aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b border-gray-100 px-4 py-4"
        >
          <span className="h-8 w-8 shrink-0 rounded-full bg-gray-100" />
          <span className="h-4 max-w-[60%] flex-1 rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ scope }: { scope: ItemScope }) {
  const message =
    scope === "TODAY"
      ? "今日買うものはまだありません"
      : "また今度買うものはまだありません";
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <ShoppingCart className="h-12 w-12 text-gray-300" aria-hidden />
      <p className="text-base font-medium text-gray-700">{message}</p>
      <p className="text-sm text-gray-500">
        下の入力欄から
        <br />
        追加してください
      </p>
    </div>
  );
}
