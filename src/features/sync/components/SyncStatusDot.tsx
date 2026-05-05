"use client";

import { memo } from "react";
import type { SyncStatus } from "@/features/sync/stores/syncStore";

const COLOR: Record<SyncStatus, string> = {
  idle: "bg-emerald-500",
  syncing: "bg-amber-400",
  offline: "bg-gray-400",
  error: "bg-red-500",
  logged_out: "hidden",
};

type Props = { status: SyncStatus };

export const SyncStatusDot = memo<Props>(function SyncStatusDot({ status }) {
  if (status === "logged_out") return null;
  return (
    <span
      className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white ${COLOR[status]}`}
      aria-hidden
    />
  );
});

SyncStatusDot.displayName = "SyncStatusDot";

export const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: "同期済み",
  syncing: "同期中",
  offline: "オフライン",
  error: "同期エラー",
  logged_out: "未ログイン",
};
