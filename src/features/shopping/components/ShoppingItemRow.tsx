"use client";

import { memo, type MouseEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { ItemScope, ShoppingItem } from "../types";

type Props = {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onMoveScope: (id: string, targetScope: ItemScope) => void;
};

export const ShoppingItemRow = memo<Props>(function ShoppingItemRow({
  item,
  onToggle,
  onMoveScope,
}) {
  const targetScope: ItemScope = item.scope === "TODAY" ? "LATER" : "TODAY";
  const moveLabel =
    item.scope === "TODAY" ? "また今度に移動" : "今日に移動";
  const MoveIcon = item.scope === "TODAY" ? ArrowRight : ArrowLeft;

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onMoveScope(item.id, targetScope);
  };

  return (
    <div className="flex w-full items-stretch border-b border-gray-100">
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className="group flex flex-1 items-center gap-3 px-4 py-3 text-left transition active:bg-gray-50"
        aria-label={`${item.name} を購入済みにする`}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 transition group-active:bg-emerald-500"
          aria-hidden
        >
          <Check
            className="h-5 w-5 text-gray-400 transition group-active:text-white"
            strokeWidth={3}
            aria-hidden
          />
        </span>
        <span className="flex-1 truncate text-base text-gray-900">
          {item.name}
        </span>
      </button>
      <button
        type="button"
        onClick={handleMove}
        className="flex w-12 shrink-0 items-center justify-center text-gray-400 transition active:bg-gray-100 active:text-gray-700"
        aria-label={`${item.name} を${moveLabel}`}
      >
        <MoveIcon className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
});
