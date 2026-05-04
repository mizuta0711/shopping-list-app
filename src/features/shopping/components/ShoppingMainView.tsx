"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useShoppingStore } from "../stores/shoppingStore";
import { filterPendingByScope, sortItems } from "../stores/selectors";
import type { ItemScope } from "../types";
import { ShoppingItemRow } from "./ShoppingItemRow";
import { AddItemForm } from "./AddItemForm";
import { ScopeTabs } from "./ScopeTabs";

export function ShoppingMainView() {
  const [hydrated, setHydrated] = useState(false);
  const [activeScope, setActiveScope] = useState<ItemScope>("TODAY");

  useEffect(() => {
    setHydrated(useShoppingStore.persist.hasHydrated());
    const unsub = useShoppingStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  const items = useShoppingStore((state) => state.items);
  const sort = useShoppingStore((state) => state.sort);
  const togglePurchased = useShoppingStore((state) => state.togglePurchased);
  const moveScope = useShoppingStore((state) => state.moveScope);

  const todayCount = useMemo(
    () => filterPendingByScope(items, "TODAY").length,
    [items],
  );
  const laterCount = useMemo(
    () => filterPendingByScope(items, "LATER").length,
    [items],
  );

  const visibleItems = useMemo(
    () => sortItems(filterPendingByScope(items, activeScope), sort),
    [items, activeScope, sort],
  );

  const handleToggle = useCallback(
    (id: string) => togglePurchased(id),
    [togglePurchased],
  );
  const handleMoveScope = useCallback(
    (id: string, targetScope: ItemScope) => moveScope(id, targetScope),
    [moveScope],
  );

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <ShoppingCart className="h-5 w-5 text-gray-900" aria-hidden />
        <h1 className="text-lg font-bold text-gray-900">買い物リスト</h1>
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
          <ul>
            {visibleItems.map((item) => (
              <li key={item.id}>
                <ShoppingItemRow
                  item={item}
                  onToggle={handleToggle}
                  onMoveScope={handleMoveScope}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white">
        <AddItemForm scope={activeScope} />
      </div>
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
          <span className="h-6 w-6 shrink-0 rounded-full bg-gray-100" />
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
