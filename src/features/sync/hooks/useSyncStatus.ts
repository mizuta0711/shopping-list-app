"use client";

import { useSyncStore } from "@/features/sync/stores/syncStore";

export function useSyncStatus() {
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const errorMessage = useSyncStore((s) => s.errorMessage);
  return { status, lastSyncedAt, errorMessage };
}
