"use client";

import { memo, type ReactNode } from "react";
import { useSyncOnMount } from "@/features/sync/hooks/useSyncOnMount";

type Props = { children: ReactNode };

export const SyncProvider = memo<Props>(function SyncProvider({ children }) {
  useSyncOnMount();
  return <>{children}</>;
});

SyncProvider.displayName = "SyncProvider";
