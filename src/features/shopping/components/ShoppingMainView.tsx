"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, RefreshCw, ShoppingCart } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { toast } from "sonner";
import {
  STATUS_LABEL,
  SyncStatusDot,
} from "@/features/sync/components/SyncStatusDot";
import {
  SyncStatusSheet,
  type SyncStatusSheetHandle,
} from "@/features/sync/components/SyncStatusSheet";
import { useSyncStatus } from "@/features/sync/hooks/useSyncStatus";
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
import { useActiveListStore } from "../stores/activeListStore";
import { useListsStore } from "../stores/listsStore";
import { useShoppingStore } from "../stores/shoppingStore";
import { filterPendingByScope, sortItems } from "../stores/selectors";
import type { ItemScope, ShoppingItem } from "../types";
import { SortableItemRow } from "./SortableItemRow";
import { AddItemForm } from "./AddItemForm";
import { ListTabs } from "./ListTabs";
import { ScopeTabs } from "./ScopeTabs";
import { SortMenu } from "./SortMenu";
import { OnboardingModal } from "./OnboardingModal";
import { ItemEditModal } from "./ItemEditModal";

export function ShoppingMainView() {
  const [hydrated, setHydrated] = useState(false);
  const [activeScope, setActiveScope] = useState<ItemScope>("TODAY");
  // セッション中だけ表示しておく購入済みアイテムの ID 集合（誤タップ救済用）
  const [keptPurchasedIds, setKeptPurchasedIds] = useState<string[]>([]);
  // 編集モード（右上 Pencil で切り替え）: 編集/削除/並び替え操作を有効化
  const [editMode, setEditMode] = useState(false);
  // 編集中アイテム（モーダル表示）
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  // モーダルを閉じた後にフォーカスを戻す編集ボタンの ID を保持
  const editingItemIdRef = useRef<string | null>(null);

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
  const lists = useListsStore((state) => state.lists);
  const ensureUnclassified = useListsStore((state) => state.ensureUnclassified);
  const activeListId = useActiveListStore((state) => state.activeListId);
  const setActiveListId = useActiveListStore((state) => state.setActiveListId);

  // hydrated 後、activeListId が無効なら未分類にフォールバック
  useEffect(() => {
    if (!hydrated) return;
    const validIds = new Set(lists.map((l) => l.id));
    if (!activeListId || !validIds.has(activeListId)) {
      const unclassifiedId = ensureUnclassified();
      setActiveListId(unclassifiedId);
    }
  }, [hydrated, activeListId, lists, ensureUnclassified, setActiveListId]);

  // 編集モードはリスト切替時に OFF にリセット
  useEffect(() => {
    setEditMode(false);
  }, [activeListId]);
  const togglePurchased = useShoppingStore((state) => state.togglePurchased);
  const moveScope = useShoppingStore((state) => state.moveScope);
  const setSort = useShoppingStore((state) => state.setSort);
  const reorderItems = useShoppingStore((state) => state.reorderItems);
  const deleteItem = useShoppingStore((state) => state.deleteItem);
  const updateItemName = useShoppingStore((state) => state.updateItemName);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  // アクティブリストの items のみに絞る
  const itemsInList = useMemo(
    () => (activeListId ? items.filter((i) => i.listId === activeListId) : []),
    [items, activeListId],
  );

  const todayCount = useMemo(
    () => filterPendingByScope(itemsInList, "TODAY").length,
    [itemsInList],
  );
  const laterCount = useMemo(
    () => filterPendingByScope(itemsInList, "LATER").length,
    [itemsInList],
  );

  const visibleItems = useMemo<ShoppingItem[]>(() => {
    // 元の位置を維持するため、PENDING と「保持中の PURCHASED」を1つの配列でまとめてからソート
    const filtered = itemsInList.filter(
      (i) =>
        i.scope === activeScope &&
        (i.status === "PENDING" ||
          (i.status === "PURCHASED" && keptPurchasedIds.includes(i.id))),
    );
    return sortItems(filtered, sort);
  }, [itemsInList, activeScope, sort, keptPurchasedIds]);

  const keptCountThisScope = useMemo(
    () =>
      itemsInList.filter(
        (i) =>
          i.scope === activeScope &&
          i.status === "PURCHASED" &&
          keptPurchasedIds.includes(i.id),
      ).length,
    [itemsInList, activeScope, keptPurchasedIds],
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
        toast.success(`「${target.name}」を購入済みにしました`);
      } else {
        // PURCHASED → PENDING: 保持リストから外す
        setKeptPurchasedIds((prev) => prev.filter((x) => x !== id));
        toast(`「${target.name}」を未購入に戻しました`);
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

  const handleToggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  const handleEditRequest = useCallback((item: ShoppingItem) => {
    editingItemIdRef.current = item.id;
    setEditingItem(item);
  }, []);

  const returnFocusToHandle = useCallback(() => {
    const id = editingItemIdRef.current;
    if (!id) return;
    // data-item-id 属性で編集ボタンを特定してフォーカスを戻す
    const handleById = document.querySelector<HTMLButtonElement>(
      `button[data-item-id="${id}"]`,
    );
    handleById?.focus();
  }, []);

  const handleEditSave = useCallback(
    (newName: string) => {
      if (!editingItem) return;
      updateItemName(editingItem.id, newName);
      setEditingItem(null);
      toast.success("変更しました");
      returnFocusToHandle();
    },
    [editingItem, updateItemName, returnFocusToHandle],
  );

  const handleEditClose = useCallback(() => {
    setEditingItem(null);
    returnFocusToHandle();
  }, [returnFocusToHandle]);

  const handleDeleteRequest = useCallback(
    (item: ShoppingItem) => {
      const confirmed = window.confirm(
        `「${item.name}」を削除します。よろしいですか？`,
      );
      if (!confirmed) return;
      deleteItem(item.id);
      toast.success(`「${item.name}」を削除しました`);
    },
    [deleteItem],
  );

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

  const { status: syncStatus } = useSyncStatus();
  const syncSheetRef = useRef<SyncStatusSheetHandle>(null);
  const handleOpenSyncSheet = useCallback(() => {
    if (syncStatus === "logged_out") return;
    syncSheetRef.current?.open();
  }, [syncStatus]);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-gray-200 bg-white px-3 py-3">
        <button
          type="button"
          onClick={handleOpenSyncSheet}
          aria-label={
            syncStatus === "logged_out"
              ? "買い物リスト"
              : `同期状態: ${STATUS_LABEL[syncStatus]} (タップで詳細)`
          }
          disabled={syncStatus === "logged_out"}
          className="relative ml-1 flex h-9 w-9 items-center justify-center rounded-full text-gray-900 transition active:bg-gray-100 disabled:cursor-default disabled:active:bg-transparent"
        >
          <ShoppingCart className="h-5 w-5" aria-hidden />
          <SyncStatusDot status={syncStatus} />
        </button>
        <h1 className="flex-1 text-lg font-bold text-gray-900">
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
        <button
          type="button"
          onClick={handleToggleEditMode}
          aria-label={editMode ? "編集モードを終了" : "編集モードを開始"}
          aria-pressed={editMode}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition active:bg-gray-100 ${
            editMode ? "bg-gray-900 text-white active:bg-gray-700" : "text-gray-700"
          }`}
        >
          <Pencil className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <ListTabs
        lists={lists}
        activeListId={activeListId}
        onSelect={setActiveListId}
      />

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
                      editMode={editMode}
                      onEditRequest={handleEditRequest}
                      onDeleteRequest={handleDeleteRequest}
                    />
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="z-10 border-t border-gray-200 bg-white">
        <AddItemForm scope={activeScope} />
      </div>

      <BottomNav />

      {hydrated && !hasOnboarded && <OnboardingModal />}
      <SyncStatusSheet ref={syncSheetRef} />

      {editingItem && (
        <ItemEditModal
          item={editingItem}
          onSave={handleEditSave}
          onClose={handleEditClose}
        />
      )}
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
