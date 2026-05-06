"use client";

import { memo } from "react";
import type { ItemScope } from "../types";

type Props = {
  active: ItemScope;
  todayCount: number;
  laterCount: number;
  onChange: (scope: ItemScope) => void;
};

const TABS: { scope: ItemScope; label: string }[] = [
  { scope: "TODAY", label: "今日" },
  { scope: "LATER", label: "また今度" },
];

export const ScopeTabs = memo<Props>(function ScopeTabs({
  active,
  todayCount,
  laterCount,
  onChange,
}) {
  return (
    <div
      role="tablist"
      aria-label="表示期間"
      className="flex border-b border-gray-200"
    >
      {TABS.map(({ scope, label }) => {
        const count = scope === "TODAY" ? todayCount : laterCount;
        const isActive = active === scope;
        return (
          <button
            key={scope}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(scope)}
            className={
              "flex-1 py-3 text-center text-sm transition " +
              (isActive
                ? "border-b-2 border-gray-900 font-bold text-gray-900"
                : "border-b-2 border-transparent text-gray-500")
            }
          >
            {label}
            <span className="ml-1 text-xs text-gray-400">({count})</span>
          </button>
        );
      })}
    </div>
  );
});
