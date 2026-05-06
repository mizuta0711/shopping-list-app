"use client";

import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { X } from "lucide-react";
import { COACHMARK_DISMISSED_KEY } from "../types";

/**
 * Phase 10.2 アップデート初回起動時に 1 度だけ表示するバナー (PA-5 対応)。
 * 閉じるボタンタップ後は LocalStorage に表示済みフラグを立て、以後表示しない。
 */
export const ListUpgradeCoachmark = memo(function ListUpgradeCoachmark() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(COACHMARK_DISMISSED_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // 失敗時は表示しない
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(COACHMARK_DISMISSED_KEY, "1");
    } catch {
      // 無視
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="coachmark-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6"
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="閉じる"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition active:bg-gray-100"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="text-5xl" aria-hidden>
          🛍️
        </div>
        <h2
          id="coachmark-title"
          className="mt-3 text-lg font-bold text-gray-900"
        >
          店舗ごとにリストを作れるようになりました
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          「スーパー」「薬局」など、買う場所ごとにリストを分けて管理できます。
          <br />
          設定 → リスト管理 から追加できます。
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/lists/new"
            onClick={handleDismiss}
            className="rounded-full bg-gray-900 py-3 text-center text-base font-medium text-white transition active:bg-gray-700"
          >
            リストを作成する
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full py-3 text-center text-base font-medium text-gray-700 transition active:bg-gray-100"
          >
            あとで
          </button>
        </div>
      </div>
    </div>
  );
});

ListUpgradeCoachmark.displayName = "ListUpgradeCoachmark";
