"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useShoppingStore } from "../stores/shoppingStore";
import { sortItems } from "../stores/selectors";
import { ShoppingItemRow } from "./ShoppingItemRow";
import { AddItemForm } from "./AddItemForm";

export function ShoppingMainView() {
  const [hydrated, setHydrated] = useState(false);

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

  const pendingItems = useMemo(() => {
    const pending = items.filter((item) => item.status === "PENDING");
    return sortItems(pending, sort);
  }, [items, sort]);

  const handleToggle = useCallback(
    (id: string) => togglePurchased(id),
    [togglePurchased],
  );

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <ShoppingCart className="h-5 w-5 text-gray-900" aria-hidden />
        <h1 className="text-lg font-bold text-gray-900">買い物リスト</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!hydrated ? (
          <SkeletonList />
        ) : pendingItems.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-gray-100">
            {pendingItems.map((item) => (
              <li key={item.id}>
                <ShoppingItemRow item={item} onToggle={handleToggle} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white">
        <AddItemForm />
      </div>
    </main>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-gray-100" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-4">
          <span className="h-6 w-6 shrink-0 rounded-full bg-gray-100" />
          <span className="h-4 flex-1 max-w-[60%] rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <ShoppingCart className="h-12 w-12 text-gray-300" aria-hidden />
      <p className="text-base font-medium text-gray-700">リストは空です</p>
      <p className="text-sm text-gray-500">
        下の入力欄から
        <br />
        追加してください
      </p>
    </div>
  );
}
