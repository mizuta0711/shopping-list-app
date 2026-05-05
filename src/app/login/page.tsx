"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("error")) {
      toast.error("ログインに失敗しました");
    }
  }, [params]);

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  const handleSignIn = useCallback(() => {
    void signIn("google", { callbackUrl: "/" });
  }, []);

  const handleSkip = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="flex-1 text-lg font-bold text-gray-900">ログイン</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <ShoppingCart className="h-14 w-14 text-emerald-500" aria-hidden />
        <p className="text-base text-gray-700">
          ログインすると、複数の
          <br />
          端末でリストを共有できます
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-900 transition active:bg-gray-50"
        >
          <GoogleIcon className="h-5 w-5" />
          Google でログイン
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-gray-500 underline"
        >
          後で（ログインなしで使う）
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

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
