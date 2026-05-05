"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ListChecks, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useSetsStore } from "../stores/setsStore";
import { useShoppingStore } from "../stores/shoppingStore";
import type { ItemScope, ShoppingSet } from "../types";

type Props = {
  activeScope: ItemScope;
  onClose: () => void;
  /** 閉じたときにフォーカスを戻す起動ボタンの ref */
  openerRef?: RefObject<HTMLButtonElement | null>;
};

const SCOPE_LABEL: Record<ItemScope, string> = {
  TODAY: "今日",
  LATER: "また今度",
};

export const SetPickerSheet = memo<Props>(function SetPickerSheet({
  activeScope,
  onClose,
  openerRef,
}) {
  const [hydrated, setHydrated] = useState(false);
  const sets = useSetsStore((state) => state.sets);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHydrated(useSetsStore.persist.hasHydrated());
    const unsub = useSetsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  // 開いた時にフォーカスを閉じるボタンに移して a11y を担保
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // 閉じたとき起動ボタンにフォーカスを戻す
  const handleClose = useCallback(() => {
    onClose();
    // onClose でシートがアンマウントされた後にフォーカスを戻す
    requestAnimationFrame(() => {
      openerRef?.current?.focus();
    });
  }, [onClose, openerRef]);

  // ESC で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const scopeLabel = SCOPE_LABEL[activeScope];

  const handlePickSet = useCallback(
    (set: ShoppingSet) => {
      const ok = window.confirm(
        `「${set.name}」の${set.items.length}品を「${scopeLabel}」に追加します。`,
      );
      if (!ok) return;
      const before = useShoppingStore.getState().items.length;
      useShoppingStore.getState().addItems(set.items, activeScope);
      const added = useShoppingStore.getState().items.length - before;
      const skipped = set.items.length - added;
      if (added === 0) {
        toast(`「${set.name}」はすべて既存のため追加されませんでした`);
      } else if (skipped === 0) {
        toast.success(`「${set.name}」を追加しました（${added}件）`);
      } else {
        toast.success(
          `「${set.name}」を追加しました（${added}件 / ${skipped}件は重複）`,
        );
      }
      handleClose();
    },
    [activeScope, scopeLabel, handleClose],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-picker-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={(e) => {
        // backdrop タップで閉じる
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="flex max-h-[80dvh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
        <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <h2
            id="set-picker-title"
            className="flex-1 text-base font-bold text-gray-900"
          >
            セットから追加
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="閉じる"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!hydrated ? (
            <SkeletonList />
          ) : sets.length === 0 ? (
            <EmptyState onClose={onClose} />
          ) : (
            <ul>
              {sets.map((set) => (
                <li key={set.id}>
                  <button
                    type="button"
                    onClick={() => handlePickSet(set)}
                    className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-4 text-left transition active:bg-gray-50"
                  >
                    <ListChecks
                      className="h-5 w-5 shrink-0 text-gray-500"
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-base text-gray-900">
                      {set.name}
                    </span>
                    <span className="shrink-0 text-sm text-gray-500">
                      {set.items.length}品
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
});

SetPickerSheet.displayName = "SetPickerSheet";

const SkeletonList = memo(function SkeletonList() {
  return (
    <ul aria-hidden>
      {[0, 1].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b border-gray-100 px-4 py-4"
        >
          <span className="h-5 w-5 shrink-0 rounded bg-gray-100" />
          <span className="h-4 max-w-[60%] flex-1 rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
});

const EmptyState = memo<{ onClose: () => void }>(function EmptyState({
  onClose,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <ListChecks className="h-10 w-10 text-gray-300" aria-hidden />
      <p className="text-base font-medium text-gray-700">
        セットがまだありません
      </p>
      <p className="text-sm text-gray-500">
        よく一緒に買うものをまとめておくと、
        <br />
        ワンタップでリストに追加できます。
      </p>
      <Link
        href="/sets/new"
        onClick={onClose}
        className="mt-2 rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700"
      >
        セットを作成する
      </Link>
    </div>
  );
});
