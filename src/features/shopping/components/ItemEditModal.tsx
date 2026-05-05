"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { X } from "lucide-react";
import type { ShoppingItem } from "../types";

type Props = {
  item: ShoppingItem;
  onSave: (newName: string) => void;
  onClose: () => void;
};

const NAME_MAX_LENGTH = 50;

export const ItemEditModal = memo<Props>(function ItemEditModal({
  item,
  onSave,
  onClose,
}) {
  const [value, setValue] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== item.name;

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSave) return;
      onSave(trimmed);
    },
    [canSave, trimmed, onSave],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <h2
            id="item-edit-title"
            className="flex-1 text-base font-bold text-gray-900"
          >
            アイテムを編集
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">
              商品名
            </span>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={NAME_MAX_LENGTH}
              required
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none"
              aria-label="商品名"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-900 transition active:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="flex-1 rounded-full bg-gray-900 px-4 py-3 text-base font-medium text-white transition active:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

ItemEditModal.displayName = "ItemEditModal";
