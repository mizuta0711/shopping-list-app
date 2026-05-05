"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { RefreshCw, X } from "lucide-react";
import { useSyncOrchestrator } from "@/components/providers/SyncProvider";
import { useSyncStatus } from "@/features/sync/hooks/useSyncStatus";
import { STATUS_LABEL } from "./SyncStatusDot";

export type SyncStatusSheetHandle = {
  open: () => void;
};

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

export const SyncStatusSheet = forwardRef<SyncStatusSheetHandle>(
  function SyncStatusSheet(_, ref) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const orchestrator = useSyncOrchestrator();
    const { status, lastSyncedAt, errorMessage } = useSyncStatus();
    const [retrying, setRetrying] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        open: () => dialogRef.current?.showModal(),
      }),
      [],
    );

    const close = useCallback(() => dialogRef.current?.close(), []);

    const handleRetry = useCallback(async () => {
      if (!orchestrator || retrying) return;
      setRetrying(true);
      try {
        await orchestrator.retry();
      } finally {
        setRetrying(false);
      }
    }, [orchestrator, retrying]);

    return (
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(20rem,90vw)] rounded-xl p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="p-5">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-bold text-gray-900">同期状態</h2>
            <button
              type="button"
              onClick={close}
              aria-label="閉じる"
              className="-m-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">状態</dt>
              <dd className="font-medium text-gray-900">
                {STATUS_LABEL[status]}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">最終同期</dt>
              <dd className="text-gray-900">
                {lastSyncedAt ? formatRelative(lastSyncedAt) : "未同期"}
              </dd>
            </div>
          </dl>

          {status === "error" && errorMessage && (
            <p className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleRetry}
            disabled={!orchestrator || retrying || status === "logged_out"}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition active:opacity-80 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <RefreshCw
              className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`}
              aria-hidden
            />
            今すぐ同期
          </button>
        </div>
      </dialog>
    );
  },
);

SyncStatusSheet.displayName = "SyncStatusSheet";
