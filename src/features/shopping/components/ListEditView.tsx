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
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveListStore } from "../stores/activeListStore";
import { useListsStore } from "../stores/listsStore";
import { useSetsStore } from "../stores/setsStore";
import { useShoppingStore } from "../stores/shoppingStore";
import {
  LIST_EMOJI_PRESETS,
  LIST_NAME_MAX_LENGTH,
  USER_LIST_MAX_COUNT,
} from "../types";

type Props =
  | { mode: "new"; listId?: undefined }
  | { mode: "edit"; listId: string };

export const ListEditView = memo<Props>(function ListEditView({
  mode,
  listId,
}) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const lists = useListsStore((state) => state.lists);
  const addList = useListsStore((state) => state.addList);
  const updateList = useListsStore((state) => state.updateList);
  const deleteList = useListsStore((state) => state.deleteList);
  const ensureUnclassified = useListsStore((state) => state.ensureUnclassified);
  const setActiveListId = useActiveListStore((state) => state.setActiveListId);
  const activeListId = useActiveListStore((state) => state.activeListId);
  const items = useShoppingStore((state) => state.items);
  const applyListDeleted = useShoppingStore((state) => state.applyListDeleted);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(mode === "new");

  useEffect(() => {
    setHydrated(useListsStore.persist.hasHydrated());
    const unsub = useListsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  const target = useMemo(
    () => (mode === "edit" ? lists.find((l) => l.id === listId) : undefined),
    [mode, lists, listId],
  );

  useEffect(() => {
    if (mode !== "edit" || !hydrated || initialized) return;
    if (target) {
      setName(target.name);
      setEmoji(target.emoji);
    }
    setInitialized(true);
  }, [mode, hydrated, initialized, target]);

  const trimmedName = name.trim();
  const isSystem = mode === "edit" && target?.system === true;
  const canSave =
    !isSystem &&
    trimmedName.length > 0 &&
    trimmedName.length <= LIST_NAME_MAX_LENGTH;

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSave) return;
      if (mode === "new") {
        try {
          const newId = addList(trimmedName, emoji);
          setActiveListId(newId);
          toast.success("リストを作成しました");
          router.replace("/");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "リスト作成に失敗しました",
          );
        }
      } else {
        updateList(listId, { name: trimmedName, emoji });
        toast.success("リストを更新しました");
        router.replace("/lists");
      }
    },
    [
      canSave,
      mode,
      trimmedName,
      emoji,
      addList,
      updateList,
      listId,
      router,
      setActiveListId,
    ],
  );

  const handleDelete = useCallback(() => {
    if (mode !== "edit" || !target || target.system) return;
    const itemsCount = items.filter((i) => i.listId === listId).length;
    const setsCount = useSetsStore
      .getState()
      .sets.filter((s) => s.listId === listId).length;

    let message: string;
    if (itemsCount > 0 && setsCount > 0) {
      message = `「${target.name}」を削除します。所属する ${itemsCount} 件のアイテム + ${setsCount} 件のセットは未分類リストに移動されます。よろしいですか？`;
    } else if (itemsCount > 0) {
      message = `「${target.name}」を削除します。所属する ${itemsCount} 件のアイテムは未分類リストに移動されます。よろしいですか？`;
    } else if (setsCount > 0) {
      message = `「${target.name}」を削除します。所属する ${setsCount} 件のセットは未分類リストに移動されます。よろしいですか？`;
    } else {
      message = `「${target.name}」を削除します。よろしいですか？`;
    }

    const confirmed = window.confirm(message);
    if (!confirmed) return;
    const unclassifiedId = ensureUnclassified();
    // 1. 所属アイテムを未分類へ移動
    applyListDeleted(listId, unclassifiedId);
    // 2. アクティブが削除対象なら未分類へ
    if (activeListId === listId) setActiveListId(unclassifiedId);
    // 3. リスト本体削除（listsStore.deleteList 内でセット連鎖も走る）
    deleteList(listId);

    let toastMessage: string;
    if (itemsCount > 0 && setsCount > 0) {
      toastMessage = `「${target.name}」を削除しました。${itemsCount} 件のアイテム + ${setsCount} 件のセットを未分類に移動しました`;
    } else if (itemsCount > 0) {
      toastMessage = `「${target.name}」を削除しました。${itemsCount} 件のアイテムを未分類に移動しました`;
    } else if (setsCount > 0) {
      toastMessage = `「${target.name}」を削除しました。${setsCount} 件のセットを未分類に移動しました`;
    } else {
      toastMessage = `「${target.name}」を削除しました`;
    }

    toast.success(toastMessage);
    router.replace("/lists");
  }, [
    mode,
    target,
    items,
    listId,
    ensureUnclassified,
    applyListDeleted,
    activeListId,
    setActiveListId,
    deleteList,
    router,
  ]);

  if (mode === "edit" && (!hydrated || !initialized)) {
    return <SkeletonView title="リストを編集" />;
  }

  if (mode === "edit" && !target) {
    return <NotFoundView />;
  }

  // 新規モードでは作成上限を確認
  const userListsCount = lists.filter((l) => !l.system).length;
  if (mode === "new" && userListsCount >= USER_LIST_MAX_COUNT) {
    return <OverLimitView />;
  }

  const title = mode === "new" ? "リストを作成" : "リストを編集";
  const itemsCount =
    mode === "edit" ? items.filter((i) => i.listId === listId).length : 0;

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-gray-200 bg-white px-2 py-3">
          <Link
            href={mode === "new" ? "/" : "/lists"}
            aria-label="戻る"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <h1 className="flex-1 text-lg font-bold text-gray-900">{title}</h1>
          {mode === "edit" && !isSystem && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="このリストを削除"
              className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 transition active:bg-red-50"
            >
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          )}
          <button
            type="submit"
            disabled={!canSave}
            aria-label={mode === "new" ? "作成" : "保存"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-900 transition active:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            <Check className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-6">
          {isSystem && (
            <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              このリストはシステム管理のため、編集・削除はできません。
            </p>
          )}

          {/* 名前 */}
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">
              リスト名
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIST_NAME_MAX_LENGTH}
              disabled={isSystem}
              placeholder="例: スーパー"
              required
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className="mt-1 block text-right text-xs text-gray-400">
              {name.length} / {LIST_NAME_MAX_LENGTH}
            </span>
          </label>

          {/* 絵文字 */}
          <div className="mt-6">
            <span className="mb-2 block text-sm font-medium text-gray-700">
              絵文字（任意）
            </span>
            <div className="grid grid-cols-6 gap-2">
              {LIST_EMOJI_PRESETS.map((e) => {
                const selected = emoji === e;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(selected ? null : e)}
                    disabled={isSystem}
                    aria-label={`絵文字 ${e}`}
                    aria-pressed={selected}
                    className={`flex h-12 items-center justify-center rounded-xl border text-2xl transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? "border-gray-900 bg-gray-900/5"
                        : "border-gray-200 bg-white active:bg-gray-100"
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 統計（編集時のみ） */}
          {mode === "edit" && (
            <div className="mt-8 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p>所属アイテム: {itemsCount} 件</p>
            </div>
          )}
        </div>
      </form>
    </main>
  );
});

ListEditView.displayName = "ListEditView";

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
          href="/lists"
          aria-label="リスト一覧に戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-gray-900">リスト</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-base font-medium text-gray-700">
          リストが見つかりませんでした
        </p>
        <Link
          href="/lists"
          className="rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700"
        >
          一覧に戻る
        </Link>
      </div>
    </main>
  );
});

NotFoundView.displayName = "NotFoundView";

const OverLimitView = memo(function OverLimitView() {
  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-3">
        <Link
          href="/lists"
          aria-label="リスト一覧に戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-gray-900">
          リストを作成
        </h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-base font-medium text-gray-700">
          リストは最大 {USER_LIST_MAX_COUNT} 件まで作成できます
        </p>
        <Link
          href="/lists"
          className="rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700"
        >
          一覧に戻る
        </Link>
      </div>
    </main>
  );
});

OverLimitView.displayName = "OverLimitView";
