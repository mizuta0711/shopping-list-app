"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ArrowLeft, Check, ListChecks, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useSetsStore } from "../stores/setsStore";
import { parseItemNames } from "../utils/parseItemNames";
import {
  SET_ITEMS_MAX_COUNT,
  SET_NAME_MAX_LENGTH,
} from "../types";

type Props =
  | { mode: "new"; setId?: undefined }
  | { mode: "edit"; setId: string };

const ADD_INPUT_MAX_HEIGHT_PX = 160;

export const SetEditView = memo<Props>(function SetEditView({ mode, setId }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const sets = useSetsStore((state) => state.sets);
  const addSet = useSetsStore((state) => state.addSet);
  const updateSet = useSetsStore((state) => state.updateSet);
  const deleteSet = useSetsStore((state) => state.deleteSet);

  const [name, setName] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [addInput, setAddInput] = useState("");
  const [initialized, setInitialized] = useState(mode === "new");

  const addInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHydrated(useSetsStore.persist.hasHydrated());
    const unsub = useSetsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  const target = useMemo(
    () => (mode === "edit" ? sets.find((s) => s.id === setId) : undefined),
    [mode, sets, setId],
  );

  // 編集モード: hydrate 後に対象セットからフォームを初期化（一度だけ）
  useEffect(() => {
    if (mode !== "edit" || !hydrated || initialized) return;
    if (target) {
      setName(target.name);
      setItems(target.items);
    }
    setInitialized(true);
  }, [mode, hydrated, initialized, target]);

  // 追加 textarea の高さ自動調整
  useEffect(() => {
    const el = addInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, ADD_INPUT_MAX_HEIGHT_PX)}px`;
  }, [addInput]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && items.length > 0;

  const handleAddSubmit = useCallback(() => {
    const { items: parsed, truncated: inputTruncated } =
      parseItemNames(addInput);
    if (parsed.length === 0) return;
    const seen = new Set(items);
    const next = [...items];
    let truncated = inputTruncated;
    for (const n of parsed) {
      if (seen.has(n)) continue;
      if (next.length >= SET_ITEMS_MAX_COUNT) {
        truncated = true;
        break;
      }
      next.push(n);
      seen.add(n);
    }
    const added = next.length - items.length;
    setItems(next);
    setAddInput("");
    if (truncated) {
      toast(`${SET_ITEMS_MAX_COUNT}件まで登録できます`);
    } else if (added === 0) {
      toast(`すべて既存のため追加されませんでした`);
    }
  }, [addInput, items]);

  const handleAddKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleAddSubmit();
      }
    },
    [handleAddSubmit],
  );

  const handleRemove = useCallback((target: string) => {
    setItems((prev) => prev.filter((n) => n !== target));
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSave) return;
      if (mode === "new") {
        addSet(trimmedName, items);
        toast.success("セットを作成しました");
      } else {
        updateSet(setId, trimmedName, items);
        toast.success("セットを更新しました");
      }
      router.replace("/sets");
    },
    [canSave, mode, trimmedName, items, addSet, updateSet, setId, router],
  );

  const handleDelete = useCallback(() => {
    if (mode !== "edit" || !target) return;
    const confirmed = window.confirm(
      `セット「${target.name}」を削除します。よろしいですか？`,
    );
    if (!confirmed) return;
    deleteSet(setId);
    toast.success("セットを削除しました");
    router.replace("/sets");
  }, [mode, target, deleteSet, setId, router]);

  // 編集モードで hydrate 中: skeleton（初期化済みフラグで誤判定を防ぐ）
  if (mode === "edit" && (!hydrated || !initialized)) {
    return <SkeletonView title="セットを編集" />;
  }

  // 編集モードで対象が見つからない
  if (mode === "edit" && !target) {
    return <NotFoundView />;
  }

  const title = mode === "new" ? "セットを作成" : "セットを編集";
  const submitLabel = mode === "new" ? "作成" : "保存";
  const overLimit = items.length >= SET_ITEMS_MAX_COUNT;

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-gray-200 bg-white px-2 py-3">
          <Link
            href="/sets"
            aria-label="セット一覧に戻る"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <h1 className="flex-1 text-lg font-bold text-gray-900">{title}</h1>
          {mode === "edit" && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="このセットを削除"
              className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 transition active:bg-red-50"
            >
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          )}
          <button
            type="submit"
            disabled={!canSave}
            aria-label={submitLabel}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-900 transition active:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            <Check className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* セット名 */}
          <div className="px-4 pt-6">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                セット名
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={SET_NAME_MAX_LENGTH}
                placeholder="例: カレーセット"
                required
                className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          {/* 商品ヘッダ + 件数 */}
          <div className="mt-6 flex items-baseline justify-between px-4 pb-2">
            <h2 className="text-sm font-medium text-gray-700">商品</h2>
            <p
              className={`text-xs ${
                overLimit ? "text-amber-600" : "text-gray-500"
              }`}
            >
              {items.length} / {SET_ITEMS_MAX_COUNT} 品
              {overLimit && "(上限)"}
            </p>
          </div>

          {/* アイテムリスト */}
          {items.length === 0 ? (
            <p className="border-y border-gray-100 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              まだ商品がありません。
              <br />
              下の入力欄から追加してください。
            </p>
          ) : (
            <ul className="border-y border-gray-100">
              {items.map((itemName) => (
                <li
                  key={itemName}
                  className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
                >
                  <ListChecks
                    className="h-5 w-5 shrink-0 text-gray-400"
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-base text-gray-900">
                    {itemName}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(itemName)}
                    aria-label={`${itemName} を削除`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition active:bg-gray-100 active:text-gray-700"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 追加フォーム（下部固定） */}
        <div className="flex items-end gap-2 border-t border-gray-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <textarea
            ref={addInputRef}
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="追加したい商品名…"
            rows={1}
            disabled={overLimit}
            className="min-w-0 flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-base leading-snug text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
            aria-label="追加する商品名（改行で複数追加可能）"
          />
          <button
            type="button"
            onClick={handleAddSubmit}
            disabled={addInput.trim().length === 0 || overLimit}
            aria-label="追加"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </form>
    </main>
  );
});

SetEditView.displayName = "SetEditView";

const SkeletonView = memo<{ title: string }>(function SkeletonView({ title }) {
  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-3">
        <span className="h-9 w-9" aria-hidden />
        <h1 className="flex-1 text-lg font-bold text-gray-900">{title}</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 px-4 py-6" aria-hidden>
        <span className="h-4 w-24 rounded bg-gray-100" />
        <span className="h-12 rounded-2xl bg-gray-100" />
        <span className="h-4 w-32 rounded bg-gray-100" />
        <span className="h-32 rounded-2xl bg-gray-100" />
      </div>
    </main>
  );
});

SkeletonView.displayName = "SkeletonView";

const NotFoundView = memo(function NotFoundView() {
  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-3">
        <Link
          href="/sets"
          aria-label="セット一覧に戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-gray-900">セット</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-base font-medium text-gray-700">
          セットが見つかりませんでした
        </p>
        <Link
          href="/sets"
          className="rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700"
        >
          一覧に戻る
        </Link>
      </div>
    </main>
  );
});

NotFoundView.displayName = "NotFoundView";
