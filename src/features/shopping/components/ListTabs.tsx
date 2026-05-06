"use client";

import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { ShoppingList } from "../types";

type Props = {
  lists: ShoppingList[];
  activeListId: string | null;
  onSelect: (id: string) => void;
  /** 移動モード等で disabled にしたいとき */
  disabled?: boolean;
  /** "全リスト" 仮想タブを先頭に追加するか（履歴画面用） */
  showAllTab?: boolean;
  /** showAllTab=true の時、全リストアクティブ判定 */
  isAllActive?: boolean;
  /** showAllTab=true の時、全リスト選択 */
  onSelectAll?: () => void;
};

const ALL_TAB_ID = "__all__";

export const ListTabs = memo<Props>(function ListTabs({
  lists,
  activeListId,
  onSelect,
  disabled = false,
  showAllTab = false,
  isAllActive = false,
  onSelectAll,
}) {
  const router = useRouter();
  // ユーザー作成リストが 0 件で showAllTab でもないとき非表示 (PA-2)
  const userListsCount = lists.filter((l) => !l.system).length;
  if (!showAllTab && userListsCount === 0) return null;

  return (
    <nav
      role="tablist"
      aria-label={showAllTab ? "履歴のリスト選択" : "リスト選択"}
      className="relative flex items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-gray-200 bg-white px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {showAllTab && (
        <ListTabButton
          label="全リスト"
          emoji="📋"
          active={isAllActive}
          disabled={disabled}
          onClick={onSelectAll ?? (() => {})}
        />
      )}
      {lists.map((l) => (
        <ListTabButton
          key={l.id}
          label={l.name}
          emoji={l.emoji}
          active={!isAllActive && activeListId === l.id}
          disabled={disabled}
          onClick={() => onSelect(l.id)}
        />
      ))}
      {/* sticky 「+」ボタン: 横スクロール時も画面右端に固定 (P3 対応) */}
      {!showAllTab && (
        <button
          type="button"
          aria-label="新しいリストを作成"
          disabled={disabled}
          onClick={() => router.push("/lists/new")}
          className="sticky right-0 ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-400 bg-white text-gray-500 transition active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      )}
    </nav>
  );
});
ListTabs.displayName = "ListTabs";

type ListTabButtonProps = {
  label: string;
  emoji: string | null;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
};

const ListTabButton = memo<ListTabButtonProps>(function ListTabButton({
  label,
  emoji,
  active,
  disabled,
  onClick,
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls="main-list-panel"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 max-w-36 shrink-0 items-center gap-1 rounded-full px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "bg-gray-900 text-white"
          : "bg-gray-100 text-gray-700 active:bg-gray-200"
      }`}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
});
ListTabButton.displayName = "ListTabButton";
