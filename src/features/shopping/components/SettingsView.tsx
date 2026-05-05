"use client";

import Link from "next/link";
import { useCallback, useRef, type ChangeEvent } from "react";
import {
  ChevronRight,
  Download,
  ListChecks,
  Trash2,
  Upload,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { useShoppingStore } from "../stores/shoppingStore";
import {
  exportStateToJson,
  importStateFromFile,
} from "../utils/exportImport";
import { AccountSection } from "./AccountSection";

export function SettingsView() {
  const reset = useShoppingStore((state) => state.reset);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === "authenticated";

  const handleExport = useCallback(() => {
    const ok = exportStateToJson();
    if (!ok) {
      toast.error("エクスポートするデータがありません");
    } else {
      toast.success("エクスポートしました");
    }
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const ok = await importStateFromFile(file);
      if (!ok) {
        toast.error("インポートに失敗しました。ファイル形式を確認してください");
        return;
      }
      toast.success("インポートが完了しました");
      window.location.href = "/";
    },
    [],
  );

  const handleReset = useCallback(() => {
    const confirmed = window.confirm(
      "すべてのデータを削除します。この操作は取り消せません。続行しますか？",
    );
    if (!confirmed) return;
    reset();
    toast.success("すべてのデータを削除しました");
  }, [reset]);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="flex-1 text-lg font-bold text-gray-900">設定</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <AccountSection />

        <section className="mb-8">
          <h2 className="mb-3 px-1 text-xs font-medium uppercase text-gray-500">
            セット
          </h2>
          <Link
            href="/sets"
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition active:bg-gray-50"
          >
            <span className="flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-gray-500" aria-hidden />
              <span className="text-base text-gray-900">セット管理</span>
            </span>
            <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden />
          </Link>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 px-1 text-xs font-medium uppercase text-gray-500">
            データ
          </h2>
          {isLoggedIn && (
            <p className="mb-3 px-1 text-xs text-gray-500">
              クラウド同期中はエクスポート / インポートはバックアップ用途です。
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition active:bg-gray-50"
            >
              <span className="text-base text-gray-900">
                JSON でエクスポート
              </span>
              <Download className="h-5 w-5 text-gray-400" aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition active:bg-gray-50"
            >
              <span className="text-base text-gray-900">
                JSON からインポート
              </span>
              <Upload className="h-5 w-5 text-gray-400" aria-hidden />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="インポートするファイル"
            />
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 flex items-center justify-between rounded-lg border border-red-200 bg-white px-4 py-3 text-left text-red-600 transition active:bg-red-50"
            >
              <span className="text-base">すべてのデータを削除</span>
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 px-1 text-xs font-medium uppercase text-gray-500">
            アプリ情報
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            shopping-list-app v0.1
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
