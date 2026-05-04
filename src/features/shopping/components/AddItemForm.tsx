"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Plus } from "lucide-react";
import { useShoppingStore } from "../stores/shoppingStore";
import type { ItemScope } from "../types";

type Props = {
  scope: ItemScope;
};

const MAX_HEIGHT_PX = 160;

export const AddItemForm = memo<Props>(function AddItemForm({ scope }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const addItems = useShoppingStore((state) => state.addItems);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (value.trim().length === 0) return;
      const names = value.split("\n");
      addItems(names, scope);
      setValue("");
    },
    [addItems, value, scope],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    },
    [],
  );

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex items-end gap-2 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="追加したい商品名… (改行で複数追加)"
        rows={1}
        className="min-w-0 flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-base leading-snug text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none"
        aria-label="商品名（改行で複数追加可能）"
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
