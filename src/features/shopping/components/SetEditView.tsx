"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
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

export const SetEditView = memo<Props>(function SetEditView({ mode, setId }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const sets = useSetsStore((state) => state.sets);
  const addSet = useSetsStore((state) => state.addSet);
  const updateSet = useSetsStore((state) => state.updateSet);
  const deleteSet = useSetsStore((state) => state.deleteSet);

  const [name, setName] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [initialized, setInitialized] = useState(mode === "new");

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
      setItemsText(target.items.join("\n"));
    }
    setInitialized(true);
  }, [mode, hydrated, initialized, target]);

  const { items: parsed, truncated: overLimit } = useMemo(
    () => parseItemNames(itemsText),
    [itemsText],
  );
  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && parsed.length > 0;

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSave) return;
      if (mode === "new") {
        addSet(trimmedName, parsed);
        toast.success("セットを作成しました");
      } else {
        updateSet(setId, trimmedName, parsed);
        toast.success("セットを更新しました");
      }
      router.replace("/sets");
    },
    [canSave, mode, trimmedName, parsed, addSet, updateSet, setId, router],
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

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-3">
        <Link
          href="/sets"
          aria-label="セット一覧に戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-gray-900">{title}</h1>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col overflow-y-auto px-4 py-6"
      >
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
            aria-label="セット名"
          />
        </label>

        <label className="mt-6 block">
          <span className="mb-2 block text-sm font-medium text-gray-700">
            商品名（改行・読点・句点で区切り）
          </span>
          <textarea
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            placeholder={"玉ねぎ\nにんじん\nじゃがいも\n豚肉\nカレールー"}
            rows={8}
            className="w-full resize-y rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-base leading-relaxed text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none"
            aria-label="商品名（改行で複数）"
          />
          <p
            className={`mt-2 text-xs ${
              overLimit ? "text-amber-600" : "text-gray-500"
            }`}
          >
            {parsed.length === 0
              ? "1件以上入力してください"
              : `${parsed.length}品が登録されます`}
            {overLimit && `（${SET_ITEMS_MAX_COUNT}件まで登録できます）`}
          </p>
        </label>

        <button
          type="submit"
          disabled={!canSave}
          className="mt-8 w-full rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {submitLabel}
        </button>

        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-6 py-3 text-base font-medium text-red-600 transition active:bg-red-50"
          >
            <Trash2 className="h-5 w-5" aria-hidden />
            このセットを削除
          </button>
        )}
      </form>
    </main>
  );
});

SetEditView.displayName = "SetEditView";

const SkeletonView = memo<{ title: string }>(function SkeletonView({ title }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
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

const NotFoundView = memo(function NotFoundView() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
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
