"use client";

import { useDrag } from "@use-gesture/react";
import { memo, useEffect, useState, type ReactNode } from "react";

export type SwipeAction = {
  /** ボタンに表示する文言 */
  label: string;
  /** タップ時の処理（実行後は自動的に行が閉じる） */
  onAction: () => void;
  /** 配色: neutral=グレー（編集等）/ danger=赤（削除等） */
  color: "neutral" | "danger";
};

type Props = {
  children: ReactNode;
  actions: SwipeAction[];
  /** 親が制御。同時に開ける行は 1 行までに統一する用途 */
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/** アクション 1 個あたりの幅 (px) */
const ACTION_WIDTH = 60;
/** ロック判定の閾値: 80px 以上スワイプで指を離すと開く */
const LOCK_THRESHOLD = 80;

export const SwipeableRow = memo<Props>(function SwipeableRow({
  children,
  actions,
  isOpen,
  onOpenChange,
}) {
  const maxOffset = -ACTION_WIDTH * actions.length;
  const [offsetX, setOffsetX] = useState(isOpen ? maxOffset : 0);
  const [dragging, setDragging] = useState(false);

  // 親側 isOpen 変更を反映（別の行が開かれた等）
  useEffect(() => {
    setOffsetX(isOpen ? maxOffset : 0);
  }, [isOpen, maxOffset]);

  const bind = useDrag(
    ({ down, movement: [mx], last }) => {
      // 右方向のスワイプは無視（既に開いていれば閉じるだけ）
      if (!isOpen && mx > 0) {
        if (last) setDragging(false);
        return;
      }
      // 開いた状態からの右スワイプ → 閉じる
      const base = isOpen ? maxOffset : 0;
      const next = base + mx;
      const clamped = Math.max(maxOffset, Math.min(0, next));

      if (down) {
        setDragging(true);
        setOffsetX(clamped);
        return;
      }

      // 指を離した
      setDragging(false);
      const shouldOpen = -clamped >= LOCK_THRESHOLD;
      onOpenChange(shouldOpen);
      setOffsetX(shouldOpen ? maxOffset : 0);
    },
    {
      axis: "x",
      axisThreshold: { touch: 5, mouse: 5 },
      filterTaps: true,
      bounds: { left: maxOffset, right: 0 },
      pointer: { touch: true },
    },
  );

  return (
    <div className="relative overflow-hidden">
      {/* 行末に固定されたアクション群（背景） */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex"
        aria-hidden={!isOpen}
      >
        {actions.map((action, idx) => (
          <button
            key={idx}
            type="button"
            tabIndex={isOpen ? 0 : -1}
            onClick={() => {
              action.onAction();
              onOpenChange(false);
            }}
            aria-label={action.label}
            className={`pointer-events-auto flex h-full items-center justify-center text-sm font-medium text-white transition active:opacity-80 ${
              action.color === "danger" ? "bg-red-500" : "bg-gray-500"
            }`}
            style={{ width: `${ACTION_WIDTH}px` }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* 行本体（横にスライド） */}
      <div
        {...bind()}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
          touchAction: "pan-y",
        }}
        className="relative bg-white"
      >
        {children}
      </div>
    </div>
  );
});

SwipeableRow.displayName = "SwipeableRow";
