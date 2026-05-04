"use client";

import { memo, useCallback, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useShoppingStore } from "../stores/shoppingStore";

export const AddItemForm = memo(function AddItemForm() {
  const [value, setValue] = useState("");
  const addItem = useShoppingStore((state) => state.addItem);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      addItem(value);
      setValue("");
    },
    [addItem, value],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="追加したい商品名…"
        className="min-w-0 flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none"
        aria-label="商品名"
      />
      <button
        type="submit"
        disabled={value.trim().length === 0}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition disabled:cursor-not-allowed disabled:bg-gray-300"
        aria-label="追加"
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );
});
