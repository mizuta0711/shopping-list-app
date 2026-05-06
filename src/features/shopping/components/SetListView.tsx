"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useState } from "react";
import { ChevronRight, ListChecks, Plus } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { useSetsStore } from "../stores/setsStore";
import { useListsStore } from "../stores/listsStore";
import type { ShoppingList, ShoppingSet } from "../types";

export const SetListView = memo(function SetListView() {
  const [hydrated, setHydrated] = useState(false);
  const sets = useSetsStore((state) => state.sets);
  const lists = useListsStore((state) => state.lists);

  useEffect(() => {
    setHydrated(useSetsStore.persist.hasHydrated());
    const unsub = useSetsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  // リスト別グルーピング: ユーザー作成リスト（createdAt 昇順）→ 共通（未分類、最下部固定）
  const grouped = useMemo(() => {
    const unclassified = lists.find((l) => l.system);
    const userLists = lists
      .filter((l) => !l.system)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const result: Array<{ list: ShoppingList; label: string; sets: ShoppingSet[] }> = [];

    for (const list of userLists) {
      const listSets = sets.filter((s) => s.listId === list.id);
      if (listSets.length > 0) {
        result.push({ list, label: list.name, sets: listSets });
      }
    }

    // 未分類紐付けセット → 「共通」ラベルで最下部
    // listId: "" は v1→v2 マイグレーション後の後補正前の状態（repairMissingListIds 完了前）
    // その場合も未分類グループとして表示する
    if (unclassified) {
      const commonSets = sets.filter(
        (s) => s.listId === unclassified.id || s.listId === "",
      );
      if (commonSets.length > 0) {
        result.push({ list: unclassified, label: "共通", sets: commonSets });
      }
    }

    return result;
  }, [sets, lists]);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
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
        ) : grouped.length === 0 ? (
          <FlatList sets={sets} />
        ) : (
          <GroupedList groups={grouped} />
        )}
      </div>

      <BottomNav />
    </main>
  );
});

SetListView.displayName = "SetListView";

// ---------------- GroupedList ----------------

type GroupedListProps = {
  groups: Array<{
    list: ShoppingList;
    label: string;
    sets: ShoppingSet[];
  }>;
};

const GroupedList = memo<GroupedListProps>(function GroupedList({ groups }) {
  return (
    <div>
      {groups.map(({ list, label, sets }) => (
        <section key={list.id}>
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
            <span className="text-sm" aria-hidden>
              {list.system ? "🗂️" : (list.emoji ?? "🛒")}
            </span>
            <span className="text-xs font-medium text-gray-600">{label}</span>
          </div>
          <ul>
            {sets.map((set) => (
              <SetRow key={set.id} set={set} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
});

GroupedList.displayName = "GroupedList";

// ---------------- FlatList (フォールバック: リスト情報なし) ----------------

const FlatList = memo<{ sets: ShoppingSet[] }>(function FlatList({ sets }) {
  return (
    <ul>
      {sets.map((set) => (
        <SetRow key={set.id} set={set} />
      ))}
    </ul>
  );
});

FlatList.displayName = "FlatList";

// ---------------- SetRow ----------------

const SetRow = memo<{ set: ShoppingSet }>(function SetRow({ set }) {
  return (
    <li>
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
  );
});

SetRow.displayName = "SetRow";

// ---------------- Skeleton / Empty ----------------

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
