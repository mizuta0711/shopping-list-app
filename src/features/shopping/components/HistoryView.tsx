"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, History } from "lucide-react";
import { useShoppingStore } from "../stores/shoppingStore";
import { groupPurchasedByDate } from "../stores/selectors";
import { PurchasedItemRow } from "./PurchasedItemRow";

export function HistoryView() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(useShoppingStore.persist.hasHydrated());
    const unsub = useShoppingStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  const items = useShoppingStore((state) => state.items);
  const togglePurchased = useShoppingStore((state) => state.togglePurchased);
  const deleteItem = useShoppingStore((state) => state.deleteItem);

  // 日付グルーピングは「今」を基準に計算するため、初回マウント時の時刻に固定する
  // （リアルタイム再計算は不要、画面開いた瞬間の今日/昨日で十分）
  const [now] = useState(() => new Date());

  const groups = useMemo(
    () => (hydrated ? groupPurchasedByDate(items, now) : []),
    [items, hydrated, now],
  );

  const handleRestore = useCallback(
    (id: string) => togglePurchased(id),
    [togglePurchased],
  );
  const handleDelete = useCallback(
    (id: string) => deleteItem(id),
    [deleteItem],
  );

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-3">
        <Link
          href="/"
          aria-label="メインに戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-gray-900">購入済み</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!hydrated ? null : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {groups.map((group) => (
              <li key={group.key}>
                <h2 className="sticky top-0 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
                  {group.label}
                </h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <PurchasedItemRow
                        item={item}
                        onRestore={handleRestore}
                        onDelete={handleDelete}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <History className="h-12 w-12 text-gray-300" aria-hidden />
      <p className="text-base font-medium text-gray-700">
        購入済みアイテムはありません
      </p>
      <p className="text-sm text-gray-500">
        メイン画面で項目をタップすると
        <br />
        ここに表示されます
      </p>
    </div>
  );
}
