"use client";

import { memo, type MouseEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { ItemScope, ShoppingItem } from "../types";

type Props = {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onMoveScope: (id: string, targetScope: ItemScope) => void;
  /** 編集モード中はスコープ移動ボタンを隠し、trailing（編集/削除/ハンドル）に置き換える */
  editMode?: boolean;
  /** Phase 10.2: 移動モード中は行を選択チェックボックスに置き換える */
  moveMode?: boolean;
  /** 移動モード中の選択状態 */
  moveSelected?: boolean;
  /** 移動モード中の選択トグル */
  onMoveToggle?: (id: string) => void;
  /** 行末に追加表示する要素（編集モード時の操作ボタン群、ドラッグハンドル等） */
  trailing?: ReactNode;
};

export const ShoppingItemRow = memo<Props>(function ShoppingItemRow({
  item,
  onToggle,
  onMoveScope,
  editMode = false,
  moveMode = false,
  moveSelected = false,
  onMoveToggle,
  trailing,
}) {
  const isPurchased = item.status === "PURCHASED";

  const targetScope: ItemScope = item.scope === "TODAY" ? "LATER" : "TODAY";
  const moveLabel =
    item.scope === "TODAY" ? "また今度に移動" : "今日に移動";
  const MoveIcon = item.scope === "TODAY" ? ArrowRight : ArrowLeft;

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onMoveScope(item.id, targetScope);
  };

  const checkmark = (
    <span
      className={
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition " +
        (isPurchased
          ? "bg-emerald-500"
          : editMode
          ? "bg-gray-100"
          : "bg-gray-100 group-active:bg-emerald-500")
      }
      aria-hidden
    >
      <Check
        className={
          "h-5 w-5 transition " +
          (isPurchased
            ? "text-white"
            : editMode
            ? "text-gray-400"
            : "text-gray-400 group-active:text-white")
        }
        strokeWidth={3}
        aria-hidden
      />
    </span>
  );

  const nameLabel = (
    <span
      className={
        "flex-1 truncate text-base transition " +
        (isPurchased ? "text-gray-400 line-through" : "text-gray-900")
      }
    >
      {item.name}
    </span>
  );

  // 移動モード: 行全体タップで選択トグル + checkmark を checkbox に置き換え
  if (moveMode) {
    return (
      <button
        type="button"
        onClick={() => onMoveToggle?.(item.id)}
        aria-pressed={moveSelected}
        aria-label={`${item.name} を選択`}
        className={`group flex w-full items-stretch border-b border-gray-100 ${
          moveSelected ? "bg-emerald-50" : ""
        } active:bg-gray-50`}
      >
        {moveSelected && (
          <span
            className="w-1 shrink-0 bg-emerald-500"
            aria-hidden
          />
        )}
        <span className="flex flex-1 items-center gap-3 px-4 py-3 text-left">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
              moveSelected
                ? "border-emerald-500 bg-emerald-500"
                : "border-gray-300 bg-white"
            }`}
            aria-hidden
          >
            {moveSelected && (
              <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
            )}
          </span>
          {nameLabel}
        </span>
      </button>
    );
  }

  return (
    <div className="flex w-full items-stretch border-b border-gray-100">
      {editMode ? (
        // 編集モード: タップでチェック切替を無効化（誤操作防止）。視覚は維持
        <div className="flex flex-1 items-center gap-3 px-4 py-3">
          {checkmark}
          {nameLabel}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className="group flex flex-1 items-center gap-3 px-4 py-3 text-left transition active:bg-gray-50"
          aria-label={
            isPurchased
              ? `${item.name} を未購入に戻す`
              : `${item.name} を購入済みにする`
          }
        >
          {checkmark}
          {nameLabel}
        </button>
      )}
      {!isPurchased && !editMode && (
        <button
          type="button"
          onClick={handleMove}
          className="flex w-12 shrink-0 items-center justify-center text-gray-400 transition active:bg-gray-100 active:text-gray-700"
          aria-label={`${item.name} を${moveLabel}`}
        >
          <MoveIcon className="h-5 w-5" aria-hidden />
        </button>
      )}
      {trailing}
    </div>
  );
});

ShoppingItemRow.displayName = "ShoppingItemRow";
