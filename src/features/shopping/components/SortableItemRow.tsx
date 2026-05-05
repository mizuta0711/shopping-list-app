"use client";

import { memo, useCallback, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ItemScope, ShoppingItem } from "../types";
import { ShoppingItemRow } from "./ShoppingItemRow";
import { SwipeableRow, type SwipeAction } from "./SwipeableRow";

type Props = {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onMoveScope: (id: string, targetScope: ItemScope) => void;
  /** スワイプで開いているか（同時 1 行制限のため親が制御） */
  swipeOpen: boolean;
  onSwipeOpenChange: (open: boolean) => void;
  /** 「編集」アクション要求 */
  onEditRequest: (item: ShoppingItem) => void;
  /** 「削除」アクション要求 */
  onDeleteRequest: (item: ShoppingItem) => void;
};

export const SortableItemRow = memo<Props>(function SortableItemRow({
  item,
  onToggle,
  onMoveScope,
  swipeOpen,
  onSwipeOpenChange,
  onEditRequest,
  onDeleteRequest,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: item.status === "PURCHASED",
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    boxShadow: isDragging
      ? "0 8px 16px -4px rgba(0,0,0,0.15)"
      : undefined,
    backgroundColor: isDragging ? "#fff" : undefined,
  };

  const handleEdit = useCallback(() => onEditRequest(item), [onEditRequest, item]);
  const handleDelete = useCallback(() => onDeleteRequest(item), [onDeleteRequest, item]);

  const isPurchased = item.status === "PURCHASED";

  // PURCHASED 行: スワイプ・ハンドル・並び替えなし。素のまま表示
  // attributes（role="button" aria-disabled 等）は PENDING ドラッグ用のため展開しない
  if (isPurchased) {
    return (
      <div ref={setNodeRef} style={style}>
        <ShoppingItemRow
          item={item}
          onToggle={onToggle}
          onMoveScope={onMoveScope}
        />
      </div>
    );
  }

  // PENDING 行: SwipeableRow でラップ + 行末にドラッグハンドル
  const swipeActions: SwipeAction[] = [
    { label: "編集", onAction: handleEdit, color: "neutral" },
    { label: "削除", onAction: handleDelete, color: "danger" },
  ];

  const dragHandle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...listeners}
      aria-label={`${item.name} を並び替え`}
      data-item-id={item.id}
      className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-300 touch-none transition active:bg-gray-100 active:text-gray-500"
    >
      <GripVertical className="h-5 w-5" aria-hidden />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SwipeableRow
        actions={swipeActions}
        isOpen={swipeOpen}
        onOpenChange={onSwipeOpenChange}
      >
        <ShoppingItemRow
          item={item}
          onToggle={onToggle}
          onMoveScope={onMoveScope}
          trailing={dragHandle}
        />
      </SwipeableRow>
    </div>
  );
});

SortableItemRow.displayName = "SortableItemRow";
