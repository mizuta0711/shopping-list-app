"use client";

import { memo, useCallback, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { ItemScope, ShoppingItem } from "../types";
import { ShoppingItemRow } from "./ShoppingItemRow";

type Props = {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onMoveScope: (id: string, targetScope: ItemScope) => void;
  /** 編集モード中: ドラッグハンドル + 編集 + 削除 を表示。スコープ移動ボタンは隠す */
  editMode: boolean;
  /** 「編集」アクション要求 */
  onEditRequest: (item: ShoppingItem) => void;
  /** 「削除」アクション要求 */
  onDeleteRequest: (item: ShoppingItem) => void;
  /** Phase 10.2: 移動モード */
  moveMode?: boolean;
  moveSelected?: boolean;
  onMoveToggle?: (id: string) => void;
};

export const SortableItemRow = memo<Props>(function SortableItemRow({
  item,
  onToggle,
  onMoveScope,
  editMode,
  onEditRequest,
  onDeleteRequest,
  moveMode = false,
  moveSelected = false,
  onMoveToggle,
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
    disabled: item.status === "PURCHASED" || !editMode || moveMode,
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

  // 移動モード: チェックボックス行に置き換え（編集モードと完全排他）
  if (moveMode) {
    return (
      <div ref={setNodeRef} style={style}>
        <ShoppingItemRow
          item={item}
          onToggle={onToggle}
          onMoveScope={onMoveScope}
          moveMode
          moveSelected={moveSelected}
          onMoveToggle={onMoveToggle}
        />
      </div>
    );
  }

  // PURCHASED 行 or 非編集モード: 編集系操作なし
  // ただし編集モード中は PURCHASED 行のタップ（未購入に戻す）も無効化（誤操作防止）
  if (isPurchased || !editMode) {
    return (
      <div ref={setNodeRef} style={style}>
        <ShoppingItemRow
          item={item}
          onToggle={onToggle}
          onMoveScope={onMoveScope}
          editMode={editMode}
        />
      </div>
    );
  }

  // PENDING + 編集モード: 編集 + 削除 + ドラッグハンドル
  const trailing = (
    <>
      <button
        type="button"
        onClick={handleEdit}
        aria-label={`${item.name} を編集`}
        data-item-id={item.id}
        className="flex w-11 shrink-0 items-center justify-center text-gray-500 transition active:bg-gray-100 active:text-gray-900"
      >
        <Pencil className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`${item.name} を削除`}
        className="flex w-11 shrink-0 items-center justify-center text-red-500 transition active:bg-red-50 active:text-red-700"
      >
        <Trash2 className="h-5 w-5" aria-hidden />
      </button>
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...listeners}
        aria-label={`${item.name} を並び替え`}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-300 touch-none transition active:bg-gray-100 active:text-gray-500"
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>
    </>
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ShoppingItemRow
        item={item}
        onToggle={onToggle}
        onMoveScope={onMoveScope}
        editMode
        trailing={trailing}
      />
    </div>
  );
});

SortableItemRow.displayName = "SortableItemRow";
