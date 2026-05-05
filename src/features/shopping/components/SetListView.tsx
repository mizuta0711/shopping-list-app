"use client";

import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ListChecks, Plus } from "lucide-react";
import { useSetsStore } from "../stores/setsStore";

export const SetListView = memo(function SetListView() {
  const [hydrated, setHydrated] = useState(false);
  const sets = useSetsStore((state) => state.sets);

  useEffect(() => {
    setHydrated(useSetsStore.persist.hasHydrated());
    const unsub = useSetsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-3">
        <Link
          href="/settings"
          aria-label="設定に戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-gray-900">セット</h1>
        <Link
          href="/sets/new"
          aria-label="新しいセットを作成"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!hydrated ? (
          <SkeletonList />
        ) : sets.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {sets.map((set) => (
              <li key={set.id}>
                <Link
                  href={`/sets/${set.id}`}
                  className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 transition active:bg-gray-50"
                >
                  <ListChecks
                    className="h-5 w-5 shrink-0 text-gray-500"
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-base text-gray-900">
                    {set.name}
                  </span>
                  <span className="shrink-0 text-sm text-gray-500">
                    {set.items.length}品
                  </span>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-gray-400"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
});

SetListView.displayName = "SetListView";

const SkeletonList = memo(function SkeletonList() {
  return (
    <ul aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b border-gray-100 px-4 py-4"
        >
          <span className="h-5 w-5 shrink-0 rounded bg-gray-100" />
          <span className="h-4 max-w-[60%] flex-1 rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <ListChecks className="h-12 w-12 text-gray-300" aria-hidden />
      <p className="text-base font-medium text-gray-700">
        セットがまだありません
      </p>
      <p className="text-sm text-gray-500">
        よく一緒に買うものをまとめておくと、
        <br />
        ワンタップでリストに追加できます。
      </p>
      <Link
        href="/sets/new"
        className="mt-2 rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700"
      >
        最初のセットを作成
      </Link>
    </div>
  );
});
