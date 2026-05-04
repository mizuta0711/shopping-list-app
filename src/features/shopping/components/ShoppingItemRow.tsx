"use client";

import { memo } from "react";
import type { ShoppingItem } from "../types";

type Props = {
  item: ShoppingItem;
  onToggle: (id: string) => void;
};

export const ShoppingItemRow = memo<Props>(function ShoppingItemRow({
  item,
  onToggle,
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-4 text-left transition active:bg-gray-100"
      aria-label={`${item.name} を購入済みにする`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-300"
        aria-hidden
      />
      <span className="flex-1 truncate text-base text-gray-900">
        {item.name}
      </span>
    </button>
  );
});
