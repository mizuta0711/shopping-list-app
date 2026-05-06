"use client";

import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ShoppingList } from "../types";

type Props = {
  open: boolean;
  selectedCount: number;
  /** 候補リスト（呼び出し側で現在のアクティブを除外して渡す） */
  lists: ShoppingList[];
  onClose: () => void;
  onSelect: (targetListId: string) => void;
};

export const ListMoveSheet = memo<Props>(function ListMoveSheet({
  open,
  selectedCount,
  lists,
  onClose,
  onSelect,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="list-move-sheet-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80dvh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1.5 w-10 rounded-full bg-gray-300" aria-hidden />
        </div>
        <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <h2
            id="list-move-sheet-title"
            className="flex-1 text-base font-bold text-gray-900"
          >
            {selectedCount} 件のアイテムを移動
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {lists.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-500">
              移動先のリストがありません
            </p>
          ) : (
            <ul>
              {lists.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(l.id)}
                    className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-4 text-left transition active:bg-gray-50"
                  >
                    <span className="text-2xl" aria-hidden>
                      {l.emoji ?? "🛒"}
                    </span>
                    <span className="flex-1 truncate text-base text-gray-900">
                      {l.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
});

ListMoveSheet.displayName = "ListMoveSheet";
