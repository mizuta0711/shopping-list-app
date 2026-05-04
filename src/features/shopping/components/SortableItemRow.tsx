"use client";

import { memo, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ItemScope, ShoppingItem } from "../types";
import { ShoppingItemRow } from "./ShoppingItemRow";

type Props = {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onMoveScope: (id: string, targetScope: ItemScope) => void;
};

export const SortableItemRow = memo<Props>(function SortableItemRow({
  item,
  onToggle,
  onMoveScope,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
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
    touchAction: "manipulation",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ShoppingItemRow
        item={item}
        onToggle={onToggle}
        onMoveScope={onMoveScope}
      />
    </div>
  );
});
