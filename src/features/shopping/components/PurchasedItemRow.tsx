"use client";

import { memo } from "react";
import { Check, Trash2, Undo2 } from "lucide-react";
import type { ShoppingItem } from "../types";

type Props = {
  item: ShoppingItem;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
};

export const PurchasedItemRow = memo<Props>(function PurchasedItemRow({
  item,
  onRestore,
  onDelete,
}) {
  return (
    <div className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-300 text-white"
        aria-hidden
      >
        <Check className="h-4 w-4" aria-hidden />
      </span>
      <span className="flex-1 truncate text-base text-gray-400 line-through">
        {item.name}
      </span>
      <button
        type="button"
        onClick={() => onRestore(item.id)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition active:bg-gray-100 active:text-gray-900"
        aria-label={`${item.name} を未購入に戻す`}
      >
        <Undo2 className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition active:bg-red-50 active:text-red-600"
        aria-label={`${item.name} を削除`}
      >
        <Trash2 className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
});
