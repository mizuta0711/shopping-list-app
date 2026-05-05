"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * SSR 対応の localStorage フック。
 * - 初期値は常に defaultValue を返す（hydration mismatch 回避）
 * - useEffect で localStorage から読み込み、値があれば差し替える
 * - キー引数が null の場合は no-op（未ログイン時の useInitialMerge で利用）
 * - JSON parse 失敗 / アクセス拒否（プライベートモード）/ 容量超過は握りつぶす
 */
export function useLocalStorage<T>(
  key: string | null,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (typeof window === "undefined" || key === null) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // parse 失敗 or アクセス拒否 → defaultValue のまま
    }
  }, [key]);

  const setAndPersist = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === "undefined" || key === null) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // QuotaExceeded 等は握りつぶす
      }
    },
    [key],
  );

  return [value, setAndPersist];
}
