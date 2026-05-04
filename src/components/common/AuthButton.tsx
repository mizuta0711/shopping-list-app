"use client";

import { memo } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export const AuthButton = memo(function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <span className="text-sm text-gray-500" aria-live="polite">
        読み込み中…
      </span>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">
          {session.user?.name ?? session.user?.email}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          サインアウト
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("google")}
      className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
    >
      Google でサインイン
    </button>
  );
});
