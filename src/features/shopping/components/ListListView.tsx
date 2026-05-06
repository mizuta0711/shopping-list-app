"use client";

import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { ChevronRight, Plus, ShoppingCart } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { useActiveListStore } from "../stores/activeListStore";
import { useListsStore } from "../stores/listsStore";
import { useShoppingStore } from "../stores/shoppingStore";
import { USER_LIST_MAX_COUNT } from "../types";

export const ListListView = memo(function ListListView() {
  const [hydrated, setHydrated] = useState(false);
  const lists = useListsStore((state) => state.lists);
  const ensureUnclassified = useListsStore((state) => state.ensureUnclassified);
  const items = useShoppingStore((state) => state.items);
  const activeListId = useActiveListStore((state) => state.activeListId);

  useEffect(() => {
    setHydrated(useListsStore.persist.hasHydrated());
    const unsub = useListsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  // 未分類が無ければ作成
  useEffect(() => {
    if (!hydrated) return;
    if (!lists.some((l) => l.system)) ensureUnclassified();
  }, [hydrated, lists, ensureUnclassified]);

  const userListsCount = lists.filter((l) => !l.system).length;
  const overLimit = userListsCount >= USER_LIST_MAX_COUNT;

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="flex-1 text-lg font-bold text-gray-900">リスト管理</h1>
        {overLimit ? (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-300"
            aria-label="リスト数上限に達しています"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </span>
        ) : (
          <Link
            href="/lists/new"
            aria-label="新しいリストを作成"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Link>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {!hydrated ? (
          <SkeletonList />
        ) : (
          <>
            <ul>
              {lists.filter((l) => !l.system).map((l) => {
                const itemsCount = items.filter(
                  (i) => i.listId === l.id,
                ).length;
                const isActive = activeListId === l.id;
                return (
                  <li key={l.id}>
                    <Link
                      href={`/lists/${l.id}`}
                      className={`flex items-center gap-3 border-b border-gray-100 px-4 py-4 transition active:bg-gray-50 ${
                        isActive ? "bg-gray-50" : ""
                      }`}
                    >
                      {isActive && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                          aria-label="アクティブ"
                        />
                      )}
                      {!isActive && (
                        <span
                          className="h-2 w-2 shrink-0"
                          aria-hidden
                        />
                      )}
                      <span className="text-2xl" aria-hidden>
                        {l.emoji ?? "🛒"}
                      </span>
                      <span className="flex-1 truncate text-base text-gray-900">
                        {l.name}
                      </span>
                      <span className="shrink-0 text-sm text-gray-500">
                        {itemsCount}件
                      </span>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-gray-400"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {overLimit && (
              <p className="px-4 py-3 text-center text-xs text-amber-600">
                ユーザー作成リストは最大 {USER_LIST_MAX_COUNT} 件まで作成できます
              </p>
            )}
            {userListsCount === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <ShoppingCart className="h-12 w-12 text-gray-300" aria-hidden />
                <p className="text-base font-medium text-gray-700">
                  店舗別リストを作ってみよう
                </p>
                <p className="text-sm text-gray-500">
                  「スーパー」「薬局」など、買う場所ごとに
                  <br />
                  リストを分けて管理できます。
                </p>
                <Link
                  href="/lists/new"
                  className="mt-2 rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700"
                >
                  最初のリストを作成
                </Link>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
});

ListListView.displayName = "ListListView";

const SkeletonList = memo(function SkeletonList() {
  return (
    <ul aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b border-gray-100 px-4 py-4"
        >
          <span className="h-6 w-6 shrink-0 rounded bg-gray-100" />
          <span className="h-4 max-w-[60%] flex-1 rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
});
