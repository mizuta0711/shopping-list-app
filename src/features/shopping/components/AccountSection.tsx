"use client";

import { useCallback, useRef } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  type ConfirmDialogHandle,
} from "@/components/common/ConfirmDialog";
import { useShoppingStore } from "@/features/shopping/stores/shoppingStore";
import { useSyncStore } from "@/features/sync/stores/syncStore";

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "たった今";
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}

export function AccountSection() {
  const { data: session, status } = useSession();
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const dialogRef = useRef<ConfirmDialogHandle>(null);

  const handleLogin = useCallback(() => {
    void signIn("google", { callbackUrl: "/" });
  }, []);

  const handleLogoutClick = useCallback(() => {
    dialogRef.current?.open();
  }, []);

  const handleLogoutConfirm = useCallback(
    async ({ checked }: { checked: boolean }) => {
      const userId = session?.user?.id;
      if (userId) {
        try {
          window.localStorage.removeItem(`sync:hasMerged:${userId}`);
        } catch {
          // ignore
        }
      }
      if (checked) {
        useShoppingStore.getState().reset();
      }
      useSyncStore.getState().reset();
      await signOut({ callbackUrl: "/" });
      toast.success("ログアウトしました");
    },
    [session?.user?.id],
  );

  if (status === "loading") {
    return (
      <section className="mb-8">
        <h2 className="mb-3 px-1 text-xs font-medium uppercase text-gray-500">
          アカウント
        </h2>
        <div className="h-14 animate-pulse rounded-lg bg-gray-100" />
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 px-1 text-xs font-medium uppercase text-gray-500">
        アカウント
      </h2>
      {status === "authenticated" && session?.user ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <UserIcon className="h-5 w-5 text-emerald-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-gray-900">
                {session.user.email}
              </div>
              {lastSyncedAt && (
                <div className="text-xs text-gray-500">
                  最終同期: {formatRelative(lastSyncedAt)}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogoutClick}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition active:bg-gray-50"
          >
            <span className="text-base text-gray-900">ログアウト</span>
            <LogOut className="h-5 w-5 text-gray-400" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLogin}
          className="flex w-full flex-col items-stretch gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition active:bg-gray-50"
        >
          <span className="text-base font-medium text-gray-900">
            Google でログイン
          </span>
          <span className="text-xs text-gray-500">
            端末間でリストを同期できます
          </span>
        </button>
      )}

      <ConfirmDialog
        ref={dialogRef}
        title="ログアウトしますか？"
        description={
          "サーバーデータは引き続きアカウントに紐づいて保管されます。\n次回ログイン時に同じリストが表示されます。"
        }
        confirmLabel="ログアウト"
        cancelLabel="キャンセル"
        destructive
        checkbox={{
          label: "この端末のローカルデータも削除する",
          default: false,
        }}
        onConfirm={handleLogoutConfirm}
      />
    </section>
  );
}
