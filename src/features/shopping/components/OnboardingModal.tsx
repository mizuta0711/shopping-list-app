"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useShoppingStore } from "../stores/shoppingStore";

export const OnboardingModal = memo(function OnboardingModal() {
  const router = useRouter();
  const setHasOnboarded = useShoppingStore((state) => state.setHasOnboarded);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = useCallback(() => {
    setHasOnboarded(true);
    router.push("/login");
  }, [router, setHasOnboarded]);

  const handleSkip = useCallback(() => {
    setHasOnboarded(true);
  }, [setHasOnboarded]);

  if (!mounted) return null;

  return createPortal(
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

      <div className="w-full max-w-xs rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm leading-relaxed text-gray-700">
        <p className="font-medium text-gray-900">この端末だけで使いますか？</p>
        <p className="mt-1 text-gray-600">
          別の端末でも使う場合は、Google アカウントで同期できます。
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          type="button"
          onClick={handleLogin}
          className="flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-900 transition active:bg-gray-50"
        >
          <GoogleIcon className="h-5 w-5" />
          Google でログイン
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="rounded-full bg-gray-900 px-6 py-3 text-base font-medium text-white transition active:bg-gray-700"
        >
          ログインせず使う
        </button>
      </div>

      <p className="text-xs text-gray-500">後から設定でログインできます</p>
    </div>,
    document.body,
  );
});

OnboardingModal.displayName = "OnboardingModal";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.61 20.08H42V20H24v8h11.3c-1.65 4.66-6.08 8-11.3 8-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.65-.39-3.92z"
      />
      <path
        fill="#FF3D00"
        d="M6.31 14.69l6.57 4.82C14.65 16.07 19 13 24 13c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 16.32 4 9.66 8.34 6.31 14.69z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.18 0 9.86-1.98 13.4-5.21l-6.19-5.24C29.16 35.09 26.71 36 24 36c-5.2 0-9.62-3.32-11.28-7.95l-6.5 5.01C9.5 39.55 16.21 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.61 20.08H42V20H24v8h11.3c-.79 2.24-2.23 4.16-4.09 5.55l6.19 5.24C40.98 35.45 44 30.18 44 24c0-1.34-.14-2.65-.39-3.92z"
      />
    </svg>
  );
}
