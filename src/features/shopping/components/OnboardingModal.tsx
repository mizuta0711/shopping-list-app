"use client";

import { memo } from "react";
import { ShoppingCart } from "lucide-react";
import { useShoppingStore } from "../stores/shoppingStore";

export const OnboardingModal = memo(function OnboardingModal() {
  const setHasOnboarded = useShoppingStore((state) => state.setHasOnboarded);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white px-8 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 text-center"
    >
      <ShoppingCart
        className="h-16 w-16 text-gray-900"
        strokeWidth={1.5}
        aria-hidden
      />

      <div>
        <h2
          id="onboarding-title"
          className="text-2xl font-bold leading-tight text-gray-900"
        >
          shopping-list-app
          <br />
          へようこそ
        </h2>
        <p className="mt-3 text-base text-gray-600">
          シンプルに使える
          <br />
          買い物リスト
        </p>
      </div>

      <div className="w-full max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-relaxed text-amber-900">
        <p className="font-medium">⚠️ データはこの端末のみに保存されます</p>
        <p className="mt-1 text-amber-800">
          端末を変更したり、ブラウザのデータを削除すると、リストも消えます。
        </p>
      </div>

      <button
        type="button"
        onClick={() => setHasOnboarded(true)}
        className="w-full max-w-xs rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700"
      >
        はじめる
      </button>
    </div>
  );
});
