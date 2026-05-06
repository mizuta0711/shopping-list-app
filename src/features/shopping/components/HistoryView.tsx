"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { useListsStore } from "../stores/listsStore";
import { useShoppingStore } from "../stores/shoppingStore";
import { groupPurchasedByDate } from "../stores/selectors";
import { ListTabs } from "./ListTabs";
import { PurchasedItemRow } from "./PurchasedItemRow";

const ALL_LISTS_TAB = "__all__";

export function HistoryView() {
  const [hydrated, setHydrated] = useState(false);
  // 履歴画面の active state はメインと独立。デフォルト = "全リスト"
  const [historyActiveListId, setHistoryActiveListId] = useState<string>(
    ALL_LISTS_TAB,
  );

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
  const lists = useListsStore((state) => state.lists);

  // 日付グルーピングは「今」を基準に計算するため、初回マウント時の時刻に固定する
  // （リアルタイム再計算は不要、画面開いた瞬間の今日/昨日で十分）
  const [now] = useState(() => new Date());

  const filteredItems = useMemo(
    () =>
      historyActiveListId === ALL_LISTS_TAB
        ? items
        : items.filter((i) => i.listId === historyActiveListId),
    [items, historyActiveListId],
  );

  const groups = useMemo(
    () => (hydrated ? groupPurchasedByDate(filteredItems, now) : []),
    [filteredItems, hydrated, now],
  );

  const handleRestore = useCallback(
    (id: string) => {
      const target = items.find((i) => i.id === id);
      togglePurchased(id);
      if (target) toast.success(`「${target.name}」を未購入に戻しました`);
    },
    [items, togglePurchased],
  );
  const handleDelete = useCallback(
    (id: string) => {
      const target = items.find((i) => i.id === id);
      deleteItem(id);
      if (target) toast(`「${target.name}」を削除しました`);
    },
    [items, deleteItem],
  );

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="flex-1 text-lg font-bold text-gray-900">購入済み</h1>
      </header>

      <ListTabs
        lists={lists}
        activeListId={
          historyActiveListId === ALL_LISTS_TAB ? null : historyActiveListId
        }
        onSelect={setHistoryActiveListId}
        showAllTab
        isAllActive={historyActiveListId === ALL_LISTS_TAB}
        onSelectAll={() => setHistoryActiveListId(ALL_LISTS_TAB)}
      />

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

      <BottomNav />
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
