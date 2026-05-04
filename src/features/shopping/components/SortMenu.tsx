"use client";

import { memo, useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";
import type { SortKey } from "../types";

type Props = {
  active: SortKey;
  onChange: (sort: SortKey) => void;
};

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: "CREATED_AT", label: "登録日時" },
  { key: "NAME", label: "名前" },
  { key: "MANUAL", label: "手動" },
];

export const SortMenu = memo<Props>(function SortMenu({ active, onChange }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (key: SortKey) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        aria-label="並び順を変更"
        aria-expanded={open}
      >
        <ArrowUpDown className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default bg-transparent"
          />
          <ul
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            {OPTIONS.map((opt) => {
              const isActive = opt.key === active;
              return (
                <li key={opt.key}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => handleSelect(opt.key)}
                    className={
                      "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition active:bg-gray-100 " +
                      (isActive
                        ? "font-medium text-gray-900"
                        : "text-gray-700")
                    }
                  >
                    <span>{opt.label}</span>
                    {isActive && (
                      <Check
                        className="h-4 w-4 text-gray-900"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
});
