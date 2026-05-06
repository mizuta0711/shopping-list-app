"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ListChecks, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useActiveListStore } from "../stores/activeListStore";
import { useListsStore } from "../stores/listsStore";
import { useSetsStore } from "../stores/setsStore";
import { useShoppingStore } from "../stores/shoppingStore";
import type { ItemScope, ShoppingSet } from "../types";

type Props = {
  activeScope: ItemScope;
  onClose: () => void;
  /** 閉じたときにフォーカスを戻す起動ボタンの ref */
  openerRef?: RefObject<HTMLButtonElement | null>;
};

type Step = "list" | "items";

export const SetPickerSheet = memo<Props>(function SetPickerSheet({
  activeScope,
  onClose,
  openerRef,
}) {
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("list");
  const [selectedSet, setSelectedSet] = useState<ShoppingSet | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // ポータル先（document.body）が利用可能になったらマウントする
  useEffect(() => {
    setMounted(true);
  }, []);
  // handleConfirm が checked の最新値を参照できるよう ref で保持（useCallback の再生成を抑制）
  const checkedRef = useRef<Set<string>>(checked);

  const sets = useSetsStore((state) => state.sets);
  const items = useShoppingStore((state) => state.items);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  // アクティブ scope の PENDING アイテム名集合（既存判定）
  const existingNames = useMemo(
    () =>
      new Set(
        items
          .filter((i) => i.scope === activeScope && i.status === "PENDING")
          .map((i) => i.name),
      ),
    [items, activeScope],
  );

  useEffect(() => {
    setHydrated(useSetsStore.persist.hasHydrated());
    const unsub = useSetsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  // 開いた時/段階遷移時にフォーカスを移して a11y を担保
  useEffect(() => {
    if (step === "list") {
      closeButtonRef.current?.focus();
    } else {
      backButtonRef.current?.focus();
    }
  }, [step]);

  // 全閉じる: 起動ボタンへフォーカスを戻す
  const handleClose = useCallback(() => {
    onClose();
    requestAnimationFrame(() => {
      openerRef?.current?.focus();
    });
  }, [onClose, openerRef]);

  // 第 2 段から第 1 段に戻る
  const handleBack = useCallback(() => {
    const empty = new Set<string>();
    checkedRef.current = empty;
    setStep("list");
    setSelectedSet(null);
    setChecked(empty);
  }, []);

  // ESC: 第 2 段なら戻る、第 1 段なら全閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (step === "items") handleBack();
      else handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, handleBack, handleClose]);

  const handlePickSet = useCallback(
    (set: ShoppingSet) => {
      if (set.items.length === 0) {
        toast(`「${set.name}」は空のセットです`);
        return;
      }
      const selectable = set.items.filter((name) => !existingNames.has(name));
      if (selectable.length === 0) {
        toast(`「${set.name}」のアイテムはすべて既にリストにあります`);
        return;
      }
      // 初期はすべてチェックなし。ユーザーが必要なものだけ選ぶ
      const initial = new Set<string>();
      checkedRef.current = initial;
      setSelectedSet(set);
      setChecked(initial);
      setStep("items");
    },
    [existingNames],
  );

  const handleToggle = useCallback(
    (name: string) => {
      if (existingNames.has(name)) return; // 既存はトグル不可
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        checkedRef.current = next;
        return next;
      });
    },
    [existingNames],
  );

  const handleConfirm = useCallback(() => {
    if (!selectedSet) return;
    // checkedRef で最新値を参照（checked state への依存を排除し再レンダリングを抑制）
    const names = selectedSet.items.filter((n) => checkedRef.current.has(n));
    if (names.length === 0) return;
    const before = useShoppingStore.getState().items.length;
    const listId =
      useActiveListStore.getState().activeListId ??
      useListsStore.getState().ensureUnclassified();
    useShoppingStore.getState().addItems(names, listId, activeScope);
    const added = useShoppingStore.getState().items.length - before;
    if (added === 0) {
      // existingNames との同期ラグ等で 0 件になった場合のフォールバック
      toast(`「${selectedSet.name}」のアイテムはすべて既にリストにあります`);
    } else {
      toast.success(`「${selectedSet.name}」から ${added} 件 追加しました`);
    }
    handleClose();
  }, [selectedSet, activeScope, handleClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={
        step === "list" ? "set-picker-title" : "set-picker-items-title"
      }
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={(e) => {
        // backdrop タップで全閉じる
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="flex max-h-[80dvh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
        {step === "list" ? (
          <ListStep
            sets={sets}
            hydrated={hydrated}
            closeButtonRef={closeButtonRef}
            onClose={handleClose}
            onPickSet={handlePickSet}
          />
        ) : (
          selectedSet && (
            <ItemsStep
              set={selectedSet}
              checked={checked}
              existingNames={existingNames}
              backButtonRef={backButtonRef}
              onBack={handleBack}
              onClose={handleClose}
              onToggle={handleToggle}
              onConfirm={handleConfirm}
            />
          )
        )}
      </div>
    </div>,
    document.body,
  );
});

SetPickerSheet.displayName = "SetPickerSheet";

// ---------------- ListStep ----------------

type ListStepProps = {
  sets: ShoppingSet[];
  hydrated: boolean;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onPickSet: (set: ShoppingSet) => void;
};

const ListStep = memo<ListStepProps>(function ListStep({
  sets,
  hydrated,
  closeButtonRef,
  onClose,
  onPickSet,
}) {
  return (
    <>
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
          onClick={onClose}
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
                  onClick={() => onPickSet(set)}
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
    </>
  );
});

ListStep.displayName = "ListStep";

// ---------------- ItemsStep ----------------

type ItemsStepProps = {
  set: ShoppingSet;
  checked: Set<string>;
  existingNames: Set<string>;
  backButtonRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onClose: () => void;
  onToggle: (name: string) => void;
  onConfirm: () => void;
};

const ItemsStep = memo<ItemsStepProps>(function ItemsStep({
  set,
  checked,
  existingNames,
  backButtonRef,
  onBack,
  onClose,
  onToggle,
  onConfirm,
}) {
  const checkedCount = checked.size;
  const canConfirm = checkedCount > 0;

  return (
    <>
      <header className="flex items-center gap-2 border-b border-gray-200 px-2 py-3">
        <button
          ref={backButtonRef}
          type="button"
          onClick={onBack}
          aria-label="セット一覧に戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <h2
          id="set-picker-items-title"
          className="flex-1 truncate text-base font-bold text-gray-900"
        >
          {set.name}
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
        <ul>
          {set.items.map((name) => {
            const isExisting = existingNames.has(name);
            const isChecked = checked.has(name);
            return (
              <li key={name}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isExisting ? true : isChecked}
                  aria-disabled={isExisting}
                  onClick={() => onToggle(name)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-4 text-left transition ${
                    isExisting
                      ? "cursor-not-allowed bg-gray-50"
                      : "active:bg-gray-50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
                      isExisting
                        ? "border-gray-300 bg-gray-200"
                        : isChecked
                        ? "border-gray-900 bg-gray-900"
                        : "border-gray-300 bg-white"
                    }`}
                    aria-hidden
                  >
                    {isExisting ? (
                      <Check className="h-4 w-4 text-gray-400" />
                    ) : isChecked ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : null}
                  </span>
                  <span
                    className={`flex-1 truncate text-base ${
                      isExisting ? "text-gray-400" : "text-gray-900"
                    }`}
                  >
                    {name}
                  </span>
                  {isExisting && (
                    <span className="shrink-0 text-xs text-gray-400">
                      既にリスト内
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          aria-label={`選択した${checkedCount}件を追加`}
          aria-disabled={!canConfirm}
          className="w-full rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          追加 ({checkedCount}件)
        </button>
      </div>
    </>
  );
});

ItemsStep.displayName = "ItemsStep";

// ---------------- Skeleton / Empty ----------------

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

SkeletonList.displayName = "SkeletonList";

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

EmptyState.displayName = "EmptyState";
